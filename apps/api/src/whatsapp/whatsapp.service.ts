import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../common/supabase.service';

const CHANNEL_SELECT =
  'id, name, phone_number, phone_number_id, business_account_id, webhook_verify_token, meta_app_id, is_active, created_at, updated_at';

@Injectable()
export class WhatsAppService {
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  private readonly baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com';

  constructor(private readonly supabase: SupabaseService) {}

  // Resolve company_id for the current user (CompanyMiddleware is not registered)
  async getCompanyId(userId: string): Promise<string> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (error || !data) throw new ForbiddenException('No active company found for this user');
    return data.company_id;
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

  async addChannel(
    userId: string,
    dto: {
      name: string;
      phone_number: string;
      phone_number_id: string;
      business_account_id: string;
      access_token: string;
      meta_app_id?: string;
    },
  ) {
    const companyId = await this.getCompanyId(userId);

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
        access_token: dto.access_token,
        webhook_verify_token: verifyToken,
        meta_app_id: dto.meta_app_id || null,
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
    const newToken = dto.access_token ?? existing.access_token;
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
    if (dto.access_token !== undefined) update.access_token = dto.access_token;
    if (dto.meta_app_id !== undefined) update.meta_app_id = dto.meta_app_id || null;
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
    return data;
  }

  async getChannelByPhoneNumberId(phoneNumberId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();
    return data;
  }

  private generateVerifyToken(): string {
    return (
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36)
    );
  }
}
