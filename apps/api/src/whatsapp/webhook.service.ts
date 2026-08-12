import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SupabaseService } from '../common/supabase.service';
import { WhatsAppService } from './whatsapp.service';
import { resolveAiProviderKey } from '../common/ai-key.util';

const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

type FlowCtx = {
  companyId: string; channelId: string; conversationId: string;
  contactId: string; contactPhone: string; accessToken: string; phoneNumberId: string;
  messageText: string; vars: Record<string, string>;
};

function validationError(type: string, value: string): string | null {
  if (type === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "That doesn't look like a valid email — could you send it again?";
  }
  return null;
}

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async verifyToken(token: string): Promise<boolean> {
    if (token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return true;
    // Also accept any channel's stored webhook_verify_token (supports multiple Meta Apps)
    const { data } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('id')
      .eq('webhook_verify_token', token)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  /**
   * Verifies Meta's X-Hub-Signature-256 HMAC against the channel's app_secret.
   * Channels created before app_secret existed have none set — for those we log a
   * loud warning but allow the request through, rather than breaking existing integrations.
   */
  async verifySignature(body: any, rawBody: Buffer | undefined, signatureHeader: string | undefined): Promise<boolean> {
    const phoneNumberId: string | undefined = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (!phoneNumberId) return true; // no message payload to forge (e.g. test pings) — let processWebhook's own checks handle it

    const channel = await this.whatsapp.getChannelByPhoneNumberId(phoneNumberId);
    if (!channel?.app_secret) {
      this.logger.warn(`Webhook signature not verified: no app_secret configured for phone_number_id ${phoneNumberId}`);
      return true;
    }

    if (!signatureHeader || !rawBody) {
      this.logger.error(`Webhook rejected: missing signature or raw body for phone_number_id ${phoneNumberId}`);
      return false;
    }

    const expected = 'sha256=' + createHmac('sha256', channel.app_secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.error(`Webhook rejected: signature mismatch for phone_number_id ${phoneNumberId}`);
      return false;
    }
    return true;
  }

  async processWebhook(body: any) {
    try {
      this.logger.log(`Webhook received: ${JSON.stringify(body).substring(0, 300)}`);
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        this.logger.warn('Webhook: no value in payload');
        return;
      }

      const phoneNumberId: string = value.metadata?.phone_number_id;
      this.logger.log(`Webhook phone_number_id: ${phoneNumberId}`);
      const channel = await this.whatsapp.getChannelByPhoneNumberId(phoneNumberId);
      if (!channel) {
        this.logger.warn(`No channel found for phone_number_id: ${phoneNumberId}`);
        return;
      }

      // Handle incoming messages
      if (value.messages?.length) {
        for (const msg of value.messages) {
          await this.handleIncomingMessage(channel, msg, value.contacts?.[0]);
        }
      }

      // Handle status updates
      if (value.statuses?.length) {
        for (const status of value.statuses) {
          await this.handleStatusUpdate(status);
        }
      }
    } catch (err) {
      this.logger.error('Webhook processing error', err);
    }
  }

  private async handleIncomingMessage(channel: any, msg: any, waContact: any) {
    const phone = msg.from;
    const companyId = channel.company_id;

    // Upsert contact
    const { data: contact } = await this.supabase.getAdminClient()
      .from('contacts')
      .upsert(
        {
          company_id: companyId,
          phone,
          name: waContact?.profile?.name || phone,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,phone' },
      )
      .select()
      .single();

    if (!contact) return;

    // Extract message content
    const extracted = this.extractContent(msg);
    const { type, mediaUrl } = extracted;
    let content = extracted.content;

    // Transcribe inbound voice notes so agents/AI can read them without downloading audio.
    let transcript: string | null = null;
    if (type === 'audio' && mediaUrl) {
      try {
        const media = await this.fetchMetaMedia(channel.access_token, mediaUrl);
        if (media) {
          transcript = await this.transcribeAudio(media.buffer, media.contentType);
          if (transcript) content = transcript;
        }
      } catch (err) {
        this.logger.error('Voice note transcription error', err as any);
      }
    }

    // Honor STOP/UNSUBSCRIBE as an opt-out — blocked contacts are skipped by campaign sends.
    if (type === 'text' && ['stop', 'unsubscribe', 'opt out', 'optout'].includes(content.trim().toLowerCase())) {
      await this.supabase.getAdminClient()
        .from('contacts')
        .update({ is_blocked: true })
        .eq('id', contact.id);
    }

    // Deduplicate — Meta retries delivery on slow/non-2xx responses, which would
    // otherwise insert the same message multiple times and re-run automations for it.
    const { data: existingMsg } = await this.supabase.getAdminClient()
      .from('messages')
      .select('id')
      .eq('wa_message_id', msg.id)
      .maybeSingle();
    if (existingMsg) {
      this.logger.log(`Duplicate message, skipping: ${msg.id}`);
      return;
    }

    // Find or create conversation
    const { conversation, isNew: isNewConversation } = await this.findOrCreateConversation(companyId, contact.id, channel.id);

    // Save message
    await this.supabase.getAdminClient()
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        company_id: companyId,
        channel_id: channel.id,
        direction: 'inbound',
        type,
        content,
        media_url: mediaUrl,
        status: 'delivered',
        wa_message_id: msg.id,
        is_note: false,
        metadata: transcript ? { ...msg, transcript } : msg,
      });

    // Update conversation
    await this.supabase.getAdminClient()
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        unread_count: (conversation.unread_count ?? 0) + 1,
        status: 'open',
      })
      .eq('id', conversation.id);

    // Mark as read
    try {
      await this.whatsapp.markMessageRead(channel.id, msg.id);
    } catch {}

    this.logger.log(`New message from ${phone} in conversation ${conversation.id}`);

    // Automations/AI-reply need real text — either a text message, or a voice note that
    // was successfully transcribed above (content already holds the transcript by then).
    const hasUsableText = type === 'text' || (type === 'audio' && !!transcript);

    if (hasUsableText) {
      const resumed = await this.resumePausedFlow({
        companyId, channelId: channel.id, conversationId: conversation.id,
        contactId: contact.id, contactPhone: phone, messageText: content,
        accessToken: channel.access_token, phoneNumberId: channel.phone_number_id,
      }).catch((err) => { this.logger.error('Flow resume error', err); return false; });

      if (!resumed) {
        await this.executeAutomations({
          companyId, channelId: channel.id, conversationId: conversation.id,
          contactId: contact.id, contactPhone: phone, messageText: content,
          accessToken: channel.access_token, phoneNumberId: channel.phone_number_id,
          isNewConversation,
        }).catch((err) => this.logger.error('Automation error', err));
      }

      // Skipped while a flow is actively mid-conversation with this contact, to avoid a double response.
      if (!resumed) {
        await this.executeAiAutoReply({
          companyId, channelId: channel.id, conversationId: conversation.id,
          contactPhone: phone, incomingMessage: content,
          accessToken: channel.access_token, phoneNumberId: channel.phone_number_id,
          wasVoiceNote: type === 'audio' && !!transcript,
        }).catch((err) => this.logger.error('AI auto-reply error', err));
      }
    }
  }

  private async handleStatusUpdate(status: any) {
    const waMessageId: string = status.id;
    const newStatus: string = status.status; // sent | delivered | read | failed

    await this.supabase.getAdminClient()
      .from('messages')
      .update({ status: newStatus })
      .eq('wa_message_id', waMessageId);

    // Update campaign recipient if applicable
    if (['delivered', 'read', 'failed'].includes(newStatus)) {
      const updateData: any = {};
      if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
      if (newStatus === 'read') updateData.read_at = new Date().toISOString();
      if (newStatus === 'failed') {
        updateData.failed_at = new Date().toISOString();
        updateData.error_message = status.errors?.[0]?.message;
      }
      updateData.status = newStatus;

      await this.supabase.getAdminClient()
        .from('campaign_recipients')
        .update(updateData)
        .eq('wa_message_id', waMessageId);
    }
  }

  private async findOrCreateConversation(companyId: string, contactId: string, channelId: string) {
    const { data: existing } = await this.supabase.getAdminClient()
      .from('conversations')
      .select('*')
      .eq('company_id', companyId)
      .eq('contact_id', contactId)
      .eq('channel_id', channelId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return { conversation: existing, isNew: false };

    const { data: created } = await this.supabase.getAdminClient()
      .from('conversations')
      .insert({
        company_id: companyId,
        contact_id: contactId,
        channel_id: channelId,
        status: 'open',
        unread_count: 0,
      })
      .select()
      .single();

    return { conversation: created, isNew: true };
  }

  // ── Automation flow execution ────────────────────────────────────────────────
  private async executeAutomations(ctx: {
    companyId: string; channelId: string; conversationId: string;
    contactId: string; contactPhone: string; messageText: string; accessToken: string; phoneNumberId: string;
    isNewConversation: boolean;
  }) {
    const { data: rules, error } = await this.supabase.getAdminClient()
      .from('automation_rules')
      .select('*')
      .eq('company_id', ctx.companyId)
      .in('trigger', ['message_received', 'keyword_matched', 'new_contact'])
      .eq('is_active', true);

    if (error) { this.logger.error(`Automation rules query failed: ${error.message}`); return; }
    if (!rules?.length) return;

    for (const rule of rules) {
      const config = rule.trigger_config || {};
      const lowerMsg = ctx.messageText.toLowerCase();

      if (rule.trigger === 'new_contact' && !ctx.isNewConversation) continue;

      if (rule.trigger === 'keyword_matched') {
        if (!config.keywords?.length) continue;
        const match = config.keywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));
        if (!match) continue;
      } else if (rule.trigger === 'message_received' && config.keywords?.length) {
        const match = config.keywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));
        if (!match) continue;
      }

      this.logger.log(`Executing automation rule: ${rule.id} ${rule.name}`);
      await this.executeFlow(rule, { ...ctx, vars: {} }).catch((err) =>
        this.logger.error(`Flow error for rule ${rule.id}`, err),
      );
    }
  }

  private async saveFlowState(conversationId: string, companyId: string, ruleId: string, resumeNodeId: string, awaitingVariable: string | undefined, vars: Record<string, string>, awaitingNodeId?: string) {
    await this.supabase.getAdminClient().from('automation_flow_state').upsert({
      conversation_id: conversationId,
      company_id: companyId,
      rule_id: ruleId,
      resume_node_id: resumeNodeId,
      awaiting_variable: awaitingVariable || null,
      awaiting_node_id: awaitingNodeId || null,
      vars,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id' });
  }

  private async clearFlowState(conversationId: string) {
    await this.supabase.getAdminClient().from('automation_flow_state').delete().eq('conversation_id', conversationId);
  }

  /** If a flow is paused waiting on this conversation's reply (last node it ran was
   *  askQuestion), captures the reply into the awaited variable and resumes from the
   *  next node instead of the flow firing every remaining step in one burst. */
  private async resumePausedFlow(ctx: {
    companyId: string; channelId: string; conversationId: string;
    contactId: string; contactPhone: string; messageText: string; accessToken: string; phoneNumberId: string;
  }): Promise<boolean> {
    const { data: state } = await this.supabase.getAdminClient()
      .from('automation_flow_state')
      .select('*')
      .eq('conversation_id', ctx.conversationId)
      .maybeSingle();
    if (!state) return false;

    const { data: rule } = await this.supabase.getAdminClient()
      .from('automation_rules')
      .select('*')
      .eq('id', state.rule_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!rule) {
      await this.clearFlowState(ctx.conversationId);
      return false;
    }

    const vars: Record<string, string> = { ...(state.vars || {}) };

    // Validate the reply against the asking node's config before accepting it — on
    // failure, re-send the question and stay paused instead of advancing with a bad value.
    if (state.awaiting_node_id) {
      const nodes: any[] = rule.trigger_config?.nodes || [];
      const askNode = nodes.find((n: any) => n.id === state.awaiting_node_id);
      const validationType = askNode?.data?.config?.validation;
      if (validationType) {
        const err = validationError(validationType, ctx.messageText);
        if (err) {
          const toPhone = ctx.contactPhone.replace(/\D/g, '');
          await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: err } }),
          }).catch(() => {});
          return true;
        }
      }
    }

    if (state.awaiting_variable) vars[state.awaiting_variable] = ctx.messageText;

    await this.executeFlow(rule, { ...ctx, vars }, state.resume_node_id);
    return true;
  }

  private async executeFlow(rule: any, ctx: FlowCtx, startNodeId?: string) {
    const nodes: any[] = rule.trigger_config?.nodes || [];
    const edges: any[] = rule.trigger_config?.edges || [];
    if (!nodes.length) return;

    const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
    let currentId = startNodeId;
    if (!currentId) {
      const startNode = nodes.find((n: any) => n.type === 'start');
      currentId = startNode?.id || '';
    }
    if (!currentId) return;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = nodeMap.get(currentId);
      if (!node || node.type === 'end') {
        await this.clearFlowState(ctx.conversationId);
        break;
      }

      if (node.type === 'condition') {
        const branch = this.evaluateCondition(node, ctx);
        const next = edges.find((e: any) => e.source === currentId && e.sourceHandle === (branch ? 'yes' : 'no'))
          || edges.find((e: any) => e.source === currentId);
        currentId = next?.target || '';
        if (!currentId) await this.clearFlowState(ctx.conversationId);
        continue;
      }

      if (node.type === 'askQuestion') {
        await this.executeFlowNode(node, ctx); // sends the question
        const next = edges.find((e: any) => e.source === currentId);
        if (next?.target) {
          await this.saveFlowState(ctx.conversationId, ctx.companyId, rule.id, next.target, node.data?.config?.variable, ctx.vars, node.id);
        } else {
          await this.clearFlowState(ctx.conversationId);
        }
        return; // pause here — wait for the customer's reply on the next inbound message
      }

      if (node.type !== 'start') {
        await this.executeFlowNode(node, ctx);
      }

      const next = edges.find((e: any) => e.source === currentId);
      currentId = next?.target || '';
      if (!currentId) await this.clearFlowState(ctx.conversationId);
    }
  }

  private evaluateCondition(node: any, ctx: FlowCtx): boolean {
    const config = node.data?.config || {};
    const ct: string = config.conditionType || 'message_contains';
    const cv: string = config.conditionValue || '';
    const msg = ctx.messageText.toLowerCase();

    if (ct === 'always_true') return true;
    if (ct === 'message_contains') return msg.includes(cv.toLowerCase());
    if (ct === 'message_equals') return msg === cv.toLowerCase();
    if (ct === 'variable_equals') {
      const [varName, varVal] = cv.split('=').map((s: string) => s.trim());
      return ctx.vars[varName] === varVal;
    }
    return false;
  }

  private interpolate(text: string, ctx: FlowCtx): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (k === 'message') return ctx.messageText;
      if (k === 'phone') return ctx.contactPhone;
      return ctx.vars[k] ?? `{{${k}}}`;
    });
  }

  private async executeFlowNode(node: any, ctx: FlowCtx) {
    const config = node.data?.config || {};
    const toPhone = ctx.contactPhone.replace(/\D/g, '');

    switch (node.type) {
      case 'sendMessage': {
        if (!config.message) break;
        const body = this.interpolate(config.message, ctx);
        const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body } }),
        });
        const json = await res.json();
        const waId = json.messages?.[0]?.id;
        if (waId) {
          await this.supabase.getAdminClient().from('messages').insert({
            conversation_id: ctx.conversationId, company_id: ctx.companyId, channel_id: ctx.channelId,
            direction: 'outbound', type: 'text', content: body,
            status: 'sent', wa_message_id: waId, is_note: false,
          });
        }
        break;
      }

      case 'askQuestion': {
        if (!config.question) break;
        const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: config.question } }),
        });
        const json = await res.json();
        if (json.messages?.[0]?.id) {
          await this.supabase.getAdminClient().from('messages').insert({
            conversation_id: ctx.conversationId, company_id: ctx.companyId, channel_id: ctx.channelId,
            direction: 'outbound', type: 'text', content: config.question,
            status: 'sent', wa_message_id: json.messages[0].id, is_note: false,
          });
        }
        break;
      }

      case 'update': {
        const val = this.interpolate(config.value || '', ctx);
        const allowed = ['name', 'email', 'notes'];
        if (allowed.includes(config.field)) {
          await this.supabase.getAdminClient().from('contacts')
            .update({ [config.field]: val })
            .eq('company_id', ctx.companyId)
            .eq('phone', ctx.contactPhone);
        }
        break;
      }

      case 'createLead': {
        const title = this.interpolate(config.title || '{{message}}', ctx);
        const { data: lead, error: leadErr } = await this.supabase.getAdminClient()
          .from('leads')
          .insert({
            company_id: ctx.companyId,
            contact_id: ctx.contactId,
            conversation_id: ctx.conversationId,
            title: title || 'New lead',
            stage: config.stage || 'new_lead',
            notes: config.notes ? this.interpolate(config.notes, ctx) : null,
          })
          .select('id')
          .single();
        if (leadErr) this.logger.error(`createLead failed: ${leadErr.message}`);
        else if (lead) ctx.vars['lead.id'] = lead.id;
        break;
      }

      case 'variable': {
        const k = config.varName;
        const v = config.varValue || '';
        if (k) ctx.vars[k] = this.interpolate(v, ctx);
        break;
      }

      case 'webhook': {
        if (!config.url) break;
        const method = config.method || 'POST';
        const bodyStr = config.body ? this.interpolate(config.body, ctx) : undefined;
        await fetch(config.url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(bodyStr && method !== 'GET' ? { body: bodyStr } : {}),
        }).catch((err) => this.logger.error('Automation webhook node error', err));
        break;
      }

      default:
        this.logger.log(`Unhandled automation node type: ${node.type}`);
    }
  }

  // ── Text-to-speech reply (voice note in, voice note back) ────────────────────
  private async synthesizeSpeech(text: string, apiKey: string): Promise<Buffer | null> {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice: 'alloy', input: text, response_format: 'mp3' }),
    });
    if (!res.ok) {
      this.logger.error(`TTS failed: ${await res.text().catch(() => res.statusText)}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  }

  private async uploadMetaMedia(accessToken: string, phoneNumberId: string, buffer: Buffer): Promise<string | null> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', new Blob([new Uint8Array(buffer)], { type: 'audio/mpeg' }), 'reply.mp3');
    form.append('type', 'audio/mpeg');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) {
      this.logger.error(`Media upload failed: ${await res.text().catch(() => res.statusText)}`);
      return null;
    }
    const json = await res.json();
    return json.id || null;
  }

  // ── AI auto-reply ─────────────────────────────────────────────────────────────
  private async executeAiAutoReply(ctx: {
    companyId: string; channelId: string; conversationId: string;
    contactPhone: string; incomingMessage: string; accessToken: string; phoneNumberId: string;
    wasVoiceNote?: boolean;
  }) {
    const { data: settings } = await this.supabase.getAdminClient()
      .from('ai_settings')
      .select('*')
      .eq('company_id', ctx.companyId)
      .maybeSingle();
    if (!settings?.is_enabled || !settings?.auto_reply) return;

    const openaiKey = await resolveAiProviderKey(this.supabase.getAdminClient());
    if (!openaiKey) return;

    const { data: history } = await this.supabase.getAdminClient()
      .from('messages')
      .select('direction, content')
      .eq('conversation_id', ctx.conversationId)
      .eq('is_note', false)
      .order('created_at', { ascending: false })
      .limit(10);

    const chatMessages = [
      { role: 'system', content: settings.system_prompt || 'You are a helpful customer support assistant.' },
      ...(history || []).reverse().map((m: any) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: settings.model || 'gpt-4o-mini', messages: chatMessages, max_tokens: 300, temperature: 0.7 }),
    });
    if (!aiRes.ok) {
      this.logger.error(`AI auto-reply: OpenAI call failed (${aiRes.status})`);
      return;
    }
    const aiJson = await aiRes.json();
    const replyText = aiJson.choices?.[0]?.message?.content?.trim();
    if (!replyText) return;

    const toPhone = ctx.contactPhone.replace(/\D/g, '');

    // If the inbound message was a voice note, reply in kind — synthesize speech and
    // send as an audio message. Falls back to text if TTS/upload fails for any reason.
    let json: any = null;
    let sentType: 'text' | 'audio' = 'text';
    if (ctx.wasVoiceNote) {
      try {
        const speech = await this.synthesizeSpeech(replyText, openaiKey);
        const mediaId = speech ? await this.uploadMetaMedia(ctx.accessToken, ctx.phoneNumberId, speech) : null;
        if (mediaId) {
          const audioRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhone, type: 'audio', audio: { id: mediaId } }),
          });
          json = await audioRes.json();
          sentType = 'audio';
        }
      } catch (err) {
        this.logger.error('Voice reply error, falling back to text', err as any);
      }
    }

    if (!json) {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: replyText } }),
      });
      json = await res.json();
      sentType = 'text';
    }

    if (json.messages?.[0]?.id) {
      await this.supabase.getAdminClient().from('messages').insert({
        conversation_id: ctx.conversationId, company_id: ctx.companyId, channel_id: ctx.channelId,
        direction: 'outbound', type: sentType, content: replyText,
        status: 'sent', wa_message_id: json.messages[0].id, is_note: false,
      });
    }
  }

  private async fetchMetaMedia(accessToken: string, mediaId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return null;
    const { url: downloadUrl } = await metaRes.json();
    if (!downloadUrl) return null;

    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return null;

    return {
      buffer: Buffer.from(await fileRes.arrayBuffer()),
      contentType: fileRes.headers.get('content-type') || 'audio/ogg',
    };
  }

  private async transcribeAudio(buffer: Buffer, contentType: string): Promise<string | null> {
    const apiKey = await resolveAiProviderKey(this.supabase.getAdminClient());
    if (!apiKey) return null;

    const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('mpeg') ? 'mp3' : 'ogg';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }), `voice-note.${ext}`);
    form.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      this.logger.error(`Transcription failed: ${await res.text().catch(() => res.statusText)}`);
      return null;
    }
    const json = await res.json();
    return json.text?.trim() || null;
  }

  private extractContent(msg: any): { type: string; content: string; mediaUrl?: string } {
    switch (msg.type) {
      case 'text':
        return { type: 'text', content: msg.text?.body || '' };
      case 'image':
        return { type: 'image', content: msg.image?.caption || '[Image]', mediaUrl: msg.image?.id };
      case 'document':
        return { type: 'document', content: msg.document?.filename || '[Document]', mediaUrl: msg.document?.id };
      case 'audio':
        return { type: 'audio', content: '[Voice message]', mediaUrl: msg.audio?.id };
      case 'video':
        return { type: 'video', content: msg.video?.caption || '[Video]', mediaUrl: msg.video?.id };
      case 'location':
        return {
          type: 'location',
          content: `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`,
        };
      default:
        return { type: 'text', content: `[${msg.type}]` };
    }
  }
}
