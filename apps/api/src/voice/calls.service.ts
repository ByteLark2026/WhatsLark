import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { jwt as twilioJwt, twiml as twilioTwiml, validateRequest } from 'twilio';
import OpenAI from 'openai';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';
import { VoiceChannelsService } from './voice-channels.service';

const { AccessToken } = twilioJwt;
const { VoiceGrant } = AccessToken;
const VoiceResponse = twilioTwiml.VoiceResponse;

// Ephemeral per-call AI conversation state and generated TTS audio — both are
// short-lived (a single call's lifetime, minutes at most), so an in-memory Map
// is sufficient; no need for DB-backed state for a v1 turn-based flow.
const aiConversations = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
const ttsAudioCache = new Map<string, { buffer: Buffer; expires: number }>();

const AI_SYSTEM_PROMPT = `You are a helpful phone support assistant. Reply in the same language the caller is speaking (English or Malayalam). Keep replies short and natural for a phone conversation — 1-2 sentences. If the caller asks for a human agent, acknowledge and say you'll connect them.`;

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly voiceChannels: VoiceChannelsService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async getCompanyId(userId: string): Promise<string> {
    const companyId = await resolveCompanyId(this.supabase.getAdminClient(), userId);
    if (!companyId) throw new ForbiddenException('No active company found for this user');
    return companyId;
  }

  // ── Browser calling: access token ──────────────────────────────────────────
  async generateAccessToken(companyId: string, userId: string): Promise<string> {
    const channel = await this.voiceChannels.getChannelWithSecrets(companyId);

    const token = new AccessToken(channel.account_sid, channel.api_key_sid, channel.api_key_secret, {
      identity: `agent_${userId}`,
      ttl: 3600,
    });
    token.addGrant(new VoiceGrant({
      outgoingApplicationSid: channel.twiml_app_sid,
      incomingAllow: true,
    }));
    return token.toJwt();
  }

  // ── Signature verification ───────────────────────────────────────────────
  verifySignature(authToken: string, signature: string | undefined, url: string, params: Record<string, any>): boolean {
    if (!signature) return false;
    return validateRequest(authToken, signature, url, params);
  }

  /**
   * Every Twilio webhook route needs the right channel's auth_token to verify
   * X-Twilio-Signature, but which channel that is depends on the route: an
   * existing calls row (most routes, once the call has been created) → the
   * "To" number matching a channel directly (first inbound hit) → an explicit
   * company_id param (first outbound hit, before any calls row exists yet).
   */
  async resolveAuthTokenForRequest(body: Record<string, any>): Promise<string | null> {
    if (body.CallSid) {
      const call = await this.getCallBySid(body.CallSid);
      if (call?.company_id) {
        const channel = await this.voiceChannels.getChannelWithSecrets(call.company_id).catch(() => null);
        if (channel) return channel.auth_token;
      }
    }
    if (body.To) {
      const channel = await this.voiceChannels.getChannelByPhoneNumber(body.To);
      if (channel) return channel.auth_token;
    }
    if (body.company_id) {
      const channel = await this.voiceChannels.getChannelWithSecrets(body.company_id).catch(() => null);
      if (channel) return channel.auth_token;
    }
    return null;
  }

  // ── Outbound (click-to-call) ──────────────────────────────────────────────
  // Called by Twilio when the agent's browser (Voice JS SDK) places a call via
  // Device.connect({ params: { To, contact_id?, lead_id? } }) — Twilio forwards
  // those custom params to this webhook alongside CallSid/From/To.
  async outboundTwiml(
    companyId: string,
    agentUserId: string,
    callSid: string,
    to: string,
    contactId?: string,
    leadId?: string,
  ): Promise<string> {
    const channel = await this.voiceChannels.getChannelWithSecrets(companyId);

    await this.upsertCallBySid(callSid, {
      company_id: companyId,
      voice_channel_id: channel.id,
      agent_id: agentUserId,
      contact_id: contactId || null,
      lead_id: leadId || null,
      direction: 'outbound',
      from_number: channel.phone_number,
      to_number: to,
      status: 'queued',
      handled_by: 'agent',
    });

    const twiml = new VoiceResponse();
    const dial = twiml.dial({ callerId: channel.phone_number, record: 'record-from-answer' });
    dial.number(to);
    return twiml.toString();
  }

  // ── Inbound routing ───────────────────────────────────────────────────────
  async inboundTwiml(toNumber: string, fromNumber: string, callSid: string): Promise<string> {
    const channel = await this.voiceChannels.getChannelByPhoneNumber(toNumber);
    const twiml = new VoiceResponse();

    if (!channel) {
      twiml.say('This number is not configured. Goodbye.');
      twiml.hangup();
      return twiml.toString();
    }

    await this.upsertCallBySid(callSid, {
      company_id: channel.company_id,
      voice_channel_id: channel.id,
      direction: 'inbound',
      from_number: fromNumber,
      to_number: toNumber,
      status: 'ringing',
    });

    const agent = await this.findAvailableAgent(channel.company_id);

    if (agent) {
      const dial = twiml.dial({
        timeout: 20,
        record: 'record-from-answer',
        action: '/api/v1/voice/twiml/inbound-fallback',
      });
      dial.client(`agent_${agent.user_id}`);
      await this.updateCallBySid(callSid, { agent_id: agent.user_id, handled_by: 'agent' });
    } else {
      twiml.redirect('/api/v1/voice/twiml/ai-agent/start');
    }

    return twiml.toString();
  }

  /** Called when a <Dial> to an agent's browser client didn't connect (no answer/busy/declined). */
  async inboundFallbackTwiml(callSid: string, dialCallStatus: string): Promise<string> {
    const twiml = new VoiceResponse();
    if (dialCallStatus === 'completed') {
      // Agent answered and the call already finished — nothing more to do.
      twiml.hangup();
      return twiml.toString();
    }
    await this.updateCallBySid(callSid, { handled_by: 'ai' });
    twiml.redirect('/api/v1/voice/twiml/ai-agent/start');
    return twiml.toString();
  }

  private async findAvailableAgent(companyId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('is_available_for_calls', true)
      .limit(1)
      .maybeSingle();
    return data;
  }

  // ── AI voice agent (turn-based) ──────────────────────────────────────────
  async aiAgentStartTwiml(callSid: string): Promise<string> {
    aiConversations.set(callSid, []);
    const twiml = new VoiceResponse();
    await this.speak(twiml, "Hi, thanks for calling. How can I help you today?");
    twiml.record({
      action: '/api/v1/voice/twiml/ai-agent/gather',
      maxLength: 15,
      playBeep: false,
      trim: 'trim-silence',
      timeout: 3,
    });
    return twiml.toString();
  }

  async aiAgentGatherTwiml(callSid: string, recordingUrl: string): Promise<string> {
    const twiml = new VoiceResponse();
    const call = await this.getCallBySid(callSid);
    if (!call) {
      twiml.say('Sorry, something went wrong. Goodbye.');
      twiml.hangup();
      return twiml.toString();
    }
    const companyId = call.company_id;
    const channel = await this.voiceChannels.getChannelWithSecrets(companyId);

    let transcript = '';
    try {
      const audioRes = await fetch(`${recordingUrl}.mp3`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${channel.account_sid}:${channel.auth_token}`).toString('base64') },
      });
      if (audioRes.ok) {
        const buffer = Buffer.from(await audioRes.arrayBuffer());
        transcript = (await this.transcribe(buffer, 'audio/mpeg')) || '';
      }
    } catch (err) {
      this.logger.error('AI agent: failed to fetch/transcribe recording', err as any);
    }

    if (!transcript.trim()) {
      twiml.say('Sorry, I didn\'t catch that. Could you repeat?');
      twiml.record({ action: '/api/v1/voice/twiml/ai-agent/gather', maxLength: 15, playBeep: false, trim: 'trim-silence', timeout: 3 });
      return twiml.toString();
    }

    const history = aiConversations.get(callSid) || [];
    history.push({ role: 'user', content: transcript });

    const wantsHuman = /\b(human|agent|person|representative)\b/i.test(transcript);
    let replyText: string;
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: AI_SYSTEM_PROMPT }, ...history] as any,
        max_tokens: 150,
        temperature: 0.5,
      });
      replyText = completion.choices[0]?.message?.content?.trim() || "I'm sorry, could you say that again?";
    } catch (err) {
      this.logger.error('AI agent: GPT reply failed', err as any);
      replyText = "I'm having trouble right now. Let me connect you to someone who can help.";
    }
    history.push({ role: 'assistant', content: replyText });
    aiConversations.set(callSid, history);

    await this.speak(twiml, replyText);

    if (wantsHuman) {
      const agent = await this.findAvailableAgent(companyId);
      if (agent) {
        const dial = twiml.dial({ timeout: 20, record: 'record-from-answer' });
        dial.client(`agent_${agent.user_id}`);
        await this.updateCallBySid(callSid, { agent_id: agent.user_id, handled_by: 'agent' });
      } else {
        twiml.say('No agents are available right now. Please leave a message after the beep.');
        twiml.record({ maxLength: 60, playBeep: true });
      }
    } else {
      twiml.record({ action: '/api/v1/voice/twiml/ai-agent/gather', maxLength: 15, playBeep: false, trim: 'trim-silence', timeout: 3 });
    }

    return twiml.toString();
  }

  /** Serves a previously-generated TTS clip for Twilio's <Play> to fetch. */
  getCachedAudio(id: string): Buffer | null {
    const entry = ttsAudioCache.get(id);
    if (!entry || entry.expires < Date.now()) {
      ttsAudioCache.delete(id);
      return null;
    }
    return entry.buffer;
  }

  /** Plays ElevenLabs-generated audio if configured, otherwise falls back to Twilio's built-in <Say> (English-only). */
  private async speak(twiml: InstanceType<typeof VoiceResponse>, text: string): Promise<void> {
    const audioUrl = await this.synthesizeAndCache(text);
    if (audioUrl) twiml.play(audioUrl);
    else twiml.say(text);
  }

  private async synthesizeAndCache(text: string): Promise<string> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

    if (apiKey && voiceId) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          ttsAudioCache.set(id, { buffer, expires: Date.now() + 5 * 60_000 });
          return `${process.env.API_HOST || ''}/api/v1/voice/tts-audio/${id}`;
        }
        this.logger.error(`ElevenLabs TTS failed: ${res.status} ${await res.text().catch(() => '')}`);
      } catch (err) {
        this.logger.error('ElevenLabs TTS error', err as any);
      }
    }
    // Fallback: no ElevenLabs key configured, or the call failed — use Twilio's built-in <Say> (English-only, no Malayalam voice).
    return '';
  }

  private async transcribe(buffer: Buffer, contentType: string): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }), 'call.mp3');
    form.append('model', 'whisper-1');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.text?.trim() || null;
  }

  // ── Status / recording webhooks ──────────────────────────────────────────
  async handleStatusCallback(callSid: string, status: string, durationSec?: string) {
    const update: Record<string, any> = { status: this.mapTwilioStatus(status) };
    if (durationSec) update.duration_seconds = parseInt(durationSec, 10);
    if (status === 'in-progress') update.started_at = new Date().toISOString();
    if (['completed', 'no-answer', 'busy', 'failed'].includes(status)) update.ended_at = new Date().toISOString();
    await this.updateCallBySid(callSid, update);
  }

  async handleRecordingCallback(callSid: string, recordingUrl: string, recordingSid: string, durationSec?: string) {
    const call = await this.getCallBySid(callSid);
    if (!call) return;

    const channel = await this.voiceChannels.getChannelWithSecrets(call.company_id);
    let transcript: string | null = null;
    try {
      const audioRes = await fetch(`${recordingUrl}.mp3`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${channel.account_sid}:${channel.auth_token}`).toString('base64') },
      });
      if (audioRes.ok) {
        transcript = await this.transcribe(Buffer.from(await audioRes.arrayBuffer()), 'audio/mpeg');
      }
    } catch (err) {
      this.logger.error('Recording transcription failed', err as any);
    }

    await this.updateCallBySid(callSid, {
      recording_url: recordingUrl,
      recording_sid: recordingSid,
      transcript,
      duration_seconds: durationSec ? parseInt(durationSec, 10) : call.duration_seconds,
    });

    aiConversations.delete(callSid);

    // Companion activity row for the unified CRM timeline.
    if (call.contact_id || call.lead_id) {
      await this.supabase.getAdminClient().from('activities').insert({
        company_id: call.company_id,
        contact_id: call.contact_id,
        lead_id: call.lead_id,
        type: 'call',
        title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call (${call.handled_by || 'agent'})`,
        description: transcript || undefined,
        created_by: call.agent_id,
        completed_at: new Date().toISOString(),
      });
    }
  }

  private mapTwilioStatus(status: string): string {
    const map: Record<string, string> = {
      queued: 'queued', ringing: 'ringing', 'in-progress': 'in-progress',
      completed: 'completed', 'no-answer': 'no-answer', busy: 'busy', failed: 'failed',
    };
    return map[status] || 'failed';
  }

  // ── calls table helpers ──────────────────────────────────────────────────
  private async getCallBySid(callSid: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('calls').select('*').eq('twilio_call_sid', callSid).maybeSingle();
    return data;
  }

  private async upsertCallBySid(callSid: string, fields: Record<string, any>) {
    const existing = await this.getCallBySid(callSid);
    if (existing) return this.updateCallBySid(callSid, fields);
    const { error } = await this.supabase.getAdminClient()
      .from('calls').insert({ twilio_call_sid: callSid, ...fields });
    if (error) this.logger.error(`Failed to create call row for ${callSid}: ${error.message}`);
  }

  private async updateCallBySid(callSid: string, fields: Record<string, any>) {
    const { error } = await this.supabase.getAdminClient()
      .from('calls').update(fields).eq('twilio_call_sid', callSid);
    if (error) this.logger.error(`Failed to update call row for ${callSid}: ${error.message}`);
  }

  // ── Public API for the frontend ──────────────────────────────────────────
  async listCalls(companyId: string, opts: { contact_id?: string; lead_id?: string; page?: number; limit?: number } = {}) {
    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const offset = (page - 1) * limit;
    let query = this.supabase.getAdminClient()
      .from('calls')
      .select('*, contacts(id,name,phone), users:agent_id(id,full_name)', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.contact_id) query = query.eq('contact_id', opts.contact_id);
    if (opts.lead_id) query = query.eq('lead_id', opts.lead_id);
    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async setAvailability(companyId: string, userId: string, isAvailable: boolean) {
    const { error } = await this.supabase.getAdminClient()
      .from('company_users')
      .update({ is_available_for_calls: isAvailable })
      .eq('company_id', companyId)
      .eq('user_id', userId);
    if (error) throw new BadRequestException(error.message);
    return { is_available_for_calls: isAvailable };
  }
}
