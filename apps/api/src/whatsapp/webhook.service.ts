import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { WhatsAppService } from './whatsapp.service';

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

    // Find or create conversation
    let conversation = await this.findOrCreateConversation(companyId, contact.id, channel.id);

    // Extract message content
    const { type, content, mediaUrl } = this.extractContent(msg);

    // Save message
    const { data: message } = await this.supabase.getAdminClient()
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        company_id: companyId,
        direction: 'inbound',
        type,
        content,
        media_url: mediaUrl,
        status: 'delivered',
        wa_message_id: msg.id,
        is_note: false,
        metadata: msg,
      })
      .select()
      .single();

    // Update conversation
    await this.supabase.getAdminClient()
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        unread_count: conversation.unread_count + 1,
        status: 'open',
      })
      .eq('id', conversation.id);

    // Mark as read
    try {
      await this.whatsapp.markMessageRead(channel.id, msg.id);
    } catch {}

    this.logger.log(`New message from ${phone} in conversation ${conversation.id}`);
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
      .single();

    if (existing) return existing;

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

    return created;
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
