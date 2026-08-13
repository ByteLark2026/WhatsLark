import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../common/supabase.service';
import { encryptToken, decryptToken } from '../common/token-crypto.util';
import { resolveCompanyId } from '../common/company-cache.util';
import { EntitlementsService } from '../billing/entitlements.service';

const CHANNEL_SELECT =
  'id, name, phone_number, phone_number_id, business_account_id, webhook_verify_token, meta_app_id, is_active, created_at, updated_at';

@Injectable()
export class WhatsAppService {
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  private readonly baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getCompanyId(userId: string): Promise<string> {
    const companyId = await resolveCompanyId(this.supabase.getAdminClient(), userId);
    if (!companyId) throw new ForbiddenException('No active company found for this user');
    return companyId;
  }

  async getChannels(userId: string) {
    const companyId = await this.getCompanyId(userId);
    const { data, error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select(CHANNEL_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /**
   * WhatsApp Embedded Signup — the frontend runs Meta's FB.login() flow and
   * hands us back the short-lived `code` plus the phone_number_id/waba_id the
   * user picked. We exchange the code for a token server-side (needs the App
   * Secret, never exposed to the browser), register the number, pull its
   * display info, subscribe our app to the WABA, then create the channel via
   * the same addChannel() path as manual entry — same validation, same encryption.
   */
  async completeEmbeddedSignup(userId: string, dto: { code: string; phone_number_id: string; waba_id: string }) {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new BadRequestException('META_APP_ID / META_APP_SECRET not configured on the server.');
    }

    // 1. Exchange the auth code for an access token.
    let accessToken: string;
    try {
      const tokenRes = await axios.get(`${this.baseUrl}/${this.apiVersion}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, code: dto.code },
      });
      accessToken = tokenRes.data.access_token;
      if (!accessToken) throw new Error('No access_token in response');
    } catch (err: any) {
      throw new BadRequestException(`Failed to exchange embedded signup code: ${err.response?.data?.error?.message || err.message}`);
    }

    // 2. Register the phone number for Cloud API messaging (required before it can send/receive).
    try {
      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${dto.phone_number_id}/register`,
        { messaging_product: 'whatsapp', pin: '000000' },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (err: any) {
      // Already registered is fine (common on reconnect) — anything else, surface it.
      const msg = err.response?.data?.error?.message || '';
      if (!/already/i.test(msg)) {
        throw new BadRequestException(`Failed to register phone number: ${msg || err.message}`);
      }
    }

    // 3. Subscribe our app to this WABA so we actually receive webhooks for it.
    try {
      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${dto.waba_id}/subscribed_apps`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (err: any) {
      throw new BadRequestException(`Failed to subscribe to WhatsApp Business Account: ${err.response?.data?.error?.message || err.message}`);
    }

    // 4. Pull display info for the channel row.
    let displayPhone = dto.phone_number_id;
    let verifiedName = 'WhatsApp Business';
    try {
      const infoRes = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/${dto.phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      displayPhone = infoRes.data.display_phone_number || displayPhone;
      verifiedName = infoRes.data.verified_name || verifiedName;
    } catch { /* non-fatal — channel still gets created with placeholder values */ }

    return this.addChannel(userId, {
      name: verifiedName,
      phone_number: displayPhone,
      phone_number_id: dto.phone_number_id,
      business_account_id: dto.waba_id,
      access_token: accessToken,
      meta_app_id: appId,
      app_secret: appSecret,
    });
  }

  async addChannel(
    userId: string,
    dto: {
      name: string;
      phone_number: string;
      phone_number_id: string;
      business_account_id: string;
      access_token: string;
      meta_app_id?: string;
      app_secret?: string;
    },
  ) {
    const companyId = await this.getCompanyId(userId);
    await this.entitlements.canCreateChannel(companyId);

    // Validate credentials against Meta Graph API before storing
    try {
      const metaRes = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/${dto.phone_number_id}?fields=id,display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${dto.access_token}` } },
      );
    } catch (err: any) {
      const metaError = err.response?.data?.error;
      const code = metaError?.code;
      const msg = metaError?.message || err.message;
      let hint = '';
      if (code === 190) hint = ' Your access token is invalid or expired. Generate a new one from Meta App → WhatsApp → API Setup.';
      else if (code === 100) hint = ' The Phone Number ID is incorrect. Copy it from Meta App → WhatsApp → API Setup.';
      else if (code === 10) hint = ' Permission error — make sure the token has whatsapp_business_messaging permission.';
      throw new BadRequestException(
        `Meta API error [${code || 'unknown'}]: ${msg}.${hint}`,
      );
    }

    const verifyToken = this.generateVerifyToken();

    const { data, error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .insert({
        company_id: companyId,
        name: dto.name,
        phone_number: dto.phone_number,
        phone_number_id: dto.phone_number_id,
        business_account_id: dto.business_account_id,
        access_token: encryptToken(dto.access_token),
        webhook_verify_token: verifyToken,
        meta_app_id: dto.meta_app_id || null,
        app_secret: dto.app_secret ? encryptToken(dto.app_secret) : null,
        is_active: true,
      })
      .select(CHANNEL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateChannel(
    userId: string,
    channelId: string,
    dto: {
      name?: string;
      phone_number?: string;
      phone_number_id?: string;
      business_account_id?: string;
      access_token?: string;
      meta_app_id?: string;
      app_secret?: string;
      is_active?: boolean;
    },
  ) {
    const companyId = await this.getCompanyId(userId);

    // Verify ownership
    const { data: existing, error: fetchErr } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('id, phone_number_id, access_token')
      .eq('id', channelId)
      .eq('company_id', companyId)
      .single();

    if (fetchErr || !existing) throw new NotFoundException('Channel not found');

    // If credentials changed, re-validate against Meta
    const newPhoneNumberId = dto.phone_number_id ?? existing.phone_number_id;
    const newToken = dto.access_token ?? decryptToken(existing.access_token);
    if (dto.access_token || dto.phone_number_id) {
      try {
        await axios.get(
          `${this.baseUrl}/${this.apiVersion}/${newPhoneNumberId}?fields=id,display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${newToken}` } },
        );
      } catch (err: any) {
        const metaError = err.response?.data?.error;
        const code = metaError?.code;
        const msg = metaError?.message || err.message;
        let hint = '';
        if (code === 190) hint = ' Your access token is invalid or expired.';
        else if (code === 100) hint = ' The Phone Number ID is incorrect.';
        else if (code === 10) hint = ' Permission error — token needs whatsapp_business_messaging permission.';
        throw new BadRequestException(
          `Meta API error [${code || 'unknown'}]: ${msg}.${hint}`,
        );
      }
    }

    // Build update payload — never allow company_id / webhook_verify_token changes
    const update: Record<string, any> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.phone_number !== undefined) update.phone_number = dto.phone_number;
    if (dto.phone_number_id !== undefined) update.phone_number_id = dto.phone_number_id;
    if (dto.business_account_id !== undefined) update.business_account_id = dto.business_account_id;
    if (dto.access_token !== undefined) update.access_token = encryptToken(dto.access_token);
    if (dto.meta_app_id !== undefined) update.meta_app_id = dto.meta_app_id || null;
    if (dto.app_secret !== undefined) update.app_secret = dto.app_secret ? encryptToken(dto.app_secret) : null;
    if (dto.is_active !== undefined) update.is_active = dto.is_active;

    const { data, error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .update(update)
      .eq('id', channelId)
      .eq('company_id', companyId)
      .select(CHANNEL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteChannel(userId: string, channelId: string) {
    const companyId = await this.getCompanyId(userId);
    const { error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .delete()
      .eq('id', channelId)
      .eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Channel removed' };
  }

  async toggleActive(userId: string, channelId: string) {
    const companyId = await this.getCompanyId(userId);
    const { data: current } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('is_active')
      .eq('id', channelId)
      .eq('company_id', companyId)
      .single();

    if (!current) throw new NotFoundException('Channel not found');

    const { data, error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .update({ is_active: !current.is_active })
      .eq('id', channelId)
      .eq('company_id', companyId)
      .select(CHANNEL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** Ownership-checked entry point for user-triggered sends (controller-facing). */
  async sendTextMessageAsUser(userId: string, channelId: string, to: string, text: string): Promise<string> {
    const companyId = await this.getCompanyId(userId);
    const { data: owned } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('id')
      .eq('id', channelId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!owned) throw new NotFoundException('Channel not found');
    return this.sendTextMessage(channelId, to, text);
  }

  async sendTextMessage(channelId: string, to: string, text: string): Promise<string> {
    const channel = await this.getChannelWithToken(channelId);

    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${channel.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\D/g, ''), // strip non-digits
        type: 'text',
        text: { preview_url: false, body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${channel.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data?.messages?.[0]?.id;
  }

  async sendTemplateMessage(
    channelId: string,
    to: string,
    templateName: string,
    language: string,
    components: any[],
  ): Promise<string> {
    const channel = await this.getChannelWithToken(channelId);

    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${channel.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'template',
        template: { name: templateName, language: { code: language }, components },
      },
      {
        headers: {
          Authorization: `Bearer ${channel.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data?.messages?.[0]?.id;
  }

  async sendImageMessage(channelId: string, to: string, imageUrl: string, caption?: string): Promise<string> {
    const channel = await this.getChannelWithToken(channelId);

    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${channel.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\D/g, ''),
        type: 'image',
        image: { link: imageUrl, ...(caption ? { caption } : {}) },
      },
      {
        headers: {
          Authorization: `Bearer ${channel.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data?.messages?.[0]?.id;
  }

  async markMessageRead(channelId: string, waMessageId: string) {
    const channel = await this.getChannelWithToken(channelId);
    await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${channel.phone_number_id}/messages`,
      { messaging_product: 'whatsapp', status: 'read', message_id: waMessageId },
      { headers: { Authorization: `Bearer ${channel.access_token}` } },
    );
  }

  async getChannelWithToken(channelId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('*')
      .eq('id', channelId)
      .single();
    if (error || !data) throw new NotFoundException('Channel not found');
    return this.decryptChannelSecrets(data);
  }

  async getChannelByPhoneNumberId(phoneNumberId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();
    return data ? this.decryptChannelSecrets(data) : data;
  }

  private decryptChannelSecrets<T extends { access_token?: string; app_secret?: string | null }>(channel: T): T {
    return {
      ...channel,
      access_token: channel.access_token ? decryptToken(channel.access_token) : channel.access_token,
      app_secret: channel.app_secret ? decryptToken(channel.app_secret) : channel.app_secret,
    };
  }

  private generateVerifyToken(): string {
    return (
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36)
    );
  }
}
