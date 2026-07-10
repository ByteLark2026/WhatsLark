import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class ActivitiesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string, opts: {
    contact_id?: string;
    lead_id?: string;
    type?: string;
    incomplete_only?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const { contact_id, lead_id, type, incomplete_only, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('activities')
      .select(`
        *,
        contacts (id, name, phone, avatar_url),
        leads (id, title, stage),
        created_by_user:users!activities_created_by_fkey (id, full_name, avatar_url),
        assigned_user:users!activities_assigned_to_fkey (id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (contact_id) query = query.eq('contact_id', contact_id);
    if (lead_id) query = query.eq('lead_id', lead_id);
    if (type) query = query.eq('type', type);
    if (incomplete_only) query = query.is('completed_at', null);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async create(companyId: string, userId: string, dto: {
    contact_id?: string;
    lead_id?: string;
    type: string;
    title: string;
    description?: string;
    due_date?: string;
    assigned_to?: string;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('activities')
      .insert({ company_id: companyId, created_by: userId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('activities')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async complete(companyId: string, id: string) {
    return this.update(companyId, id, { completed_at: new Date().toISOString() });
  }

  async uncomplete(companyId: string, id: string) {
    return this.update(companyId, id, { completed_at: null });
  }

  async delete(companyId: string, id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('activities')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getUpcoming(companyId: string, days = 7) {
    const until = new Date();
    until.setDate(until.getDate() + days);

    const { data, error } = await this.supabase.getAdminClient()
      .from('activities')
      .select(`
        *,
        contacts (id, name, phone),
        leads (id, title, stage),
        assigned_user:users!activities_assigned_to_fkey (id, full_name)
      `)
      .eq('company_id', companyId)
      .is('completed_at', null)
      .not('due_date', 'is', null)
      .lte('due_date', until.toISOString())
      .order('due_date', { ascending: true })
      .limit(20);

    if (error) throw new BadRequestException(error.message);
    return data || [];
  }
}
