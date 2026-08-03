import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly supabase: SupabaseService,
    @InjectQueue('campaigns') private readonly campaignQueue: Queue,
  ) {}

  async getCompanyId(userId: string): Promise<string> {
    const companyId = await resolveCompanyId(this.supabase.getAdminClient(), userId);
    if (!companyId) throw new ForbiddenException('No active company found for this user');
    return companyId;
  }

  async list(companyId: string, opts: { page?: number; limit?: number } = {}) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase.getAdminClient()
      .from('campaigns')
      .select('*, message_templates (name, language), whatsapp_channels (name, phone_number)', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('campaigns')
      .select('*, message_templates (*), whatsapp_channels (id, name, phone_number)')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Campaign not found');
    return data;
  }

  async create(companyId: string, userId: string, dto: {
    name: string;
    template_id: string;
    channel_id: string;
    contact_ids?: string[];
    scheduled_at?: string;
  }) {
    const { data: campaign, error } = await this.supabase.getAdminClient()
      .from('campaigns')
      .insert({
        company_id: companyId,
        created_by: userId,
        name: dto.name,
        template_id: dto.template_id,
        channel_id: dto.channel_id,
        status: dto.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: dto.scheduled_at,
        total_recipients: dto.contact_ids?.length || 0,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Add recipients
    if (dto.contact_ids?.length) {
      const recipients = dto.contact_ids.map(cid => ({
        campaign_id: campaign.id,
        contact_id: cid,
        status: 'sent', // valid enum value; wa_message_id=null means not yet processed
      }));
      await this.supabase.getAdminClient().from('campaign_recipients').insert(recipients);
    }

    return campaign;
  }

  async launch(companyId: string, id: string) {
    const campaign = await this.get(companyId, id);

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new BadRequestException('Campaign cannot be launched in its current state');
    }

    // Atomic claim so double-clicking Launch / a retry can't enqueue two send jobs —
    // only the caller whose UPDATE sees status still draft/scheduled wins the race.
    const { data: claimed } = await this.supabase.getAdminClient()
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .in('status', ['draft', 'scheduled'])
      .select()
      .maybeSingle();
    if (!claimed) throw new BadRequestException('Campaign cannot be launched in its current state');

    // Enqueue campaign job
    await this.campaignQueue.add('send-campaign', { campaignId: id, companyId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return { message: 'Campaign launched', campaign_id: id };
  }

  async pause(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', id)
      .eq('company_id', companyId);
    return { message: 'Campaign paused' };
  }

  async getRecipients(companyId: string, campaignId: string) {
    await this.get(companyId, campaignId); // throws NotFoundException if not owned by this company
    const { data } = await this.supabase.getAdminClient()
      .from('campaign_recipients')
      .select('*, contacts (id, name, phone)')
      .eq('campaign_id', campaignId)
      .order('created_at');
    return data;
  }

  async getStats(companyId: string, campaignId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('campaigns')
      .select('total_recipients, sent_count, delivered_count, read_count, failed_count, replied_count')
      .eq('id', campaignId)
      .eq('company_id', companyId)
      .single();
    return data;
  }
}
