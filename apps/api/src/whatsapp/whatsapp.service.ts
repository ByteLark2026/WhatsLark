import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class WhatsAppService {
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
  private readonly baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com';

  constructor(private readonly supabase: SupabaseService) {}

  async addChannel(companyId: string, dto: {
    name: string;
    phone_number: string;
    phone_number_id: string;
    business_account_id: string;
    access_token: string;
  }) {
    // Verify token by calling WhatsApp API
    try {
      await axios.get(
        `${this.baseUrl}/${this.apiVersion}/${dto.phone_number_id}`,
        { headers: { Authorization: `Bearer ${dto.access_token}` } },
      );
    } catch {
      throw new BadRequestException('Invalid WhatsApp credentials. Please verify your access token and phone number ID.');
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
        access_token: dto.access_token, // store encrypted in production
        webhook_verify_token: verifyToken,
      })
      .select('id, name, phone_number, phone_number_id, business_account_id, webhook_verify_token, is_active, created_at')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getChannels(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      // Never return access_token to frontend
      .select('id, name, phone_number, phone_number_id, business_account_id, webhook_verify_token, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteChannel(companyId: string, channelId: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .delete()
      .eq('id', channelId)
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Channel deleted' };
  }

  async sendTextMessage(channelId: string, to: string, text: string): Promise<string> {
    const channel = await this.getChannelWithToken(channelId);

    const response = await axios.post(
      `${this.baseUrl}/${this.apiVersion}/${channel.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
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
        to,
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
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: waMessageId,
      },
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
      .single();
    return data;
  }

  private generateVerifyToken(): string {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}
