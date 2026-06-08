import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('message_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('message_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();
    if (error) throw new NotFoundException('Template not found');
    return data;
  }

  async create(companyId: string, dto: {
    name: string;
    language?: string;
    category?: string;
    components: any[];
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('message_templates')
      .insert({ company_id: companyId, status: 'pending', ...dto })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('message_templates')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async delete(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('message_templates')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }
}
