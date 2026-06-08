import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('companies')
      .select('*, subscriptions (plan, status, current_period_end)')
      .eq('id', companyId)
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, dto: { name?: string; logo_url?: string; timezone?: string; country?: string }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('companies')
      .update(dto)
      .eq('id', companyId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getTags(companyId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('tags')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    return data;
  }

  async createTag(companyId: string, dto: { name: string; color?: string }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('tags')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteTag(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }
}
