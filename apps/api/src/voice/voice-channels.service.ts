import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Twilio } from 'twilio';
import { SupabaseService } from '../common/supabase.service';
import { encryptToken, decryptToken } from '../common/token-crypto.util';
import { resolveCompanyId } from '../common/company-cache.util';

const CHANNEL_SELECT = 'id, name, phone_number, account_sid, api_key_sid, twiml_app_sid, is_active, created_at, updated_at';

@Injectable()
export class VoiceChannelsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getCompanyId(userId: string): Promise<string> {
    const companyId = await resolveCompanyId(this.supabase.getAdminClient(), userId);
    if (!companyId) throw new ForbiddenException('No active company found for this user');
    return companyId;
  }

  async getChannels(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .select(CHANNEL_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async addChannel(companyId: string, dto: {
    name: string;
    phone_number: string;
    account_sid: string;
    auth_token: string;
    api_key_sid: string;
    api_key_secret: string;
    twiml_app_sid: string;
  }) {
    // Validate credentials against Twilio before storing
    try {
      const client = new Twilio(dto.account_sid, dto.auth_token);
      await client.api.v2010.accounts(dto.account_sid).fetch();
    } catch (err: any) {
      throw new BadRequestException(`Twilio API error: ${err.message}. Check your Account SID and Auth Token.`);
    }

    const { data, error } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .insert({
        company_id: companyId,
        name: dto.name,
        phone_number: dto.phone_number,
        account_sid: dto.account_sid,
        auth_token: encryptToken(dto.auth_token),
        api_key_sid: dto.api_key_sid,
        api_key_secret: encryptToken(dto.api_key_secret),
        twiml_app_sid: dto.twiml_app_sid,
        is_active: true,
      })
      .select(CHANNEL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateChannel(companyId: string, channelId: string, dto: Partial<{
    name: string; phone_number: string; account_sid: string; auth_token: string;
    api_key_sid: string; api_key_secret: string; twiml_app_sid: string; is_active: boolean;
  }>) {
    const { data: existing } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .select('id')
      .eq('id', channelId)
      .eq('company_id', companyId)
      .single();
    if (!existing) throw new NotFoundException('Voice channel not found');

    const update: Record<string, any> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.phone_number !== undefined) update.phone_number = dto.phone_number;
    if (dto.account_sid !== undefined) update.account_sid = dto.account_sid;
    if (dto.auth_token !== undefined) update.auth_token = encryptToken(dto.auth_token);
    if (dto.api_key_sid !== undefined) update.api_key_sid = dto.api_key_sid;
    if (dto.api_key_secret !== undefined) update.api_key_secret = encryptToken(dto.api_key_secret);
    if (dto.twiml_app_sid !== undefined) update.twiml_app_sid = dto.twiml_app_sid;
    if (dto.is_active !== undefined) update.is_active = dto.is_active;

    const { data, error } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .update(update)
      .eq('id', channelId)
      .eq('company_id', companyId)
      .select(CHANNEL_SELECT)
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteChannel(companyId: string, channelId: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .delete()
      .eq('id', channelId)
      .eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Voice channel removed' };
  }

  /** Internal use only (calls service, TwiML/webhook handlers) — includes decrypted secrets. */
  async getChannelWithSecrets(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (error || !data) throw new NotFoundException('No active voice channel for this company');
    return {
      ...data,
      auth_token: decryptToken(data.auth_token),
      api_key_secret: decryptToken(data.api_key_secret),
    };
  }

  /** Looked up by the inbound Twilio number for webhook routing — no company context yet at that point. */
  async getChannelByPhoneNumber(phoneNumber: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('voice_channels')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) return null;
    return {
      ...data,
      auth_token: decryptToken(data.auth_token),
      api_key_secret: decryptToken(data.api_key_secret),
    };
  }
}
