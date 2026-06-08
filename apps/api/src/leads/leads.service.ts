import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class LeadsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string, opts: { stage?: string; assigned_to?: string; page?: number; limit?: number } = {}) {
    const { stage, assigned_to, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('leads')
      .select(`
        *,
        contacts (id, name, phone, avatar_url),
        users:assigned_to (id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (stage) query = query.eq('stage', stage);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async getByStage(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .select(`
        *,
        contacts (id, name, phone, avatar_url),
        users:assigned_to (id, full_name, avatar_url)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const stages = ['new_lead', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost'];
    return stages.reduce((acc, stage) => {
      acc[stage] = (data || []).filter(l => l.stage === stage);
      return acc;
    }, {} as Record<string, any[]>);
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .select(`*, contacts (*), users:assigned_to (id, full_name, avatar_url)`)
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Lead not found');
    return data;
  }

  async create(companyId: string, dto: {
    contact_id: string;
    conversation_id?: string;
    assigned_to?: string;
    stage?: string;
    title: string;
    deal_value?: number;
    currency?: string;
    expected_close_date?: string;
    notes?: string;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async moveStage(companyId: string, id: string, stage: string) {
    return this.update(companyId, id, { stage });
  }

  async delete(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }
}
