import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class ContactsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string, opts: { search?: string; tag?: string; page?: number; limit?: number } = {}) {
    const { search, tag, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('contacts')
      .select(`
        *,
        contact_tags (tags (id, name, color))
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('contacts')
      .select(`*, contact_tags (tags (id, name, color)), notes (*)`)
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Contact not found');
    return data;
  }

  async create(companyId: string, dto: {
    phone: string;
    name?: string;
    email?: string;
    custom_fields?: Record<string, string>;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('contacts')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('contacts')
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
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }

  async importCsv(companyId: string, rows: { phone: string; name?: string; email?: string }[]) {
    const records = rows.map(r => ({ company_id: companyId, ...r }));
    const { data, error } = await this.supabase.getAdminClient()
      .from('contacts')
      .upsert(records, { onConflict: 'company_id,phone' })
      .select();

    if (error) throw new BadRequestException(error.message);
    return { imported: data?.length, data };
  }

  async addTag(companyId: string, contactId: string, tagId: string) {
    await this.supabase.getAdminClient()
      .from('contact_tags')
      .upsert({ contact_id: contactId, tag_id: tagId });
    return { success: true };
  }

  async removeTag(companyId: string, contactId: string, tagId: string) {
    await this.supabase.getAdminClient()
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tagId);
    return { success: true };
  }

  async addNote(companyId: string, contactId: string, userId: string, content: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('notes')
      .insert({ company_id: companyId, contact_id: contactId, created_by: userId, content })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getTimeline(companyId: string, contactId: string) {
    const [{ data: messages }, { data: notes }, { data: leads }] = await Promise.all([
      this.supabase.getAdminClient()
        .from('messages')
        .select('id, direction, content, type, status, created_at')
        .eq('company_id', companyId)
        .in('conversation_id',
          this.supabase.getAdminClient()
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId) as any
        )
        .order('created_at', { ascending: false })
        .limit(20),
      this.supabase.getAdminClient()
        .from('notes')
        .select('id, content, created_at, users:created_by (full_name)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false }),
      this.supabase.getAdminClient()
        .from('leads')
        .select('id, title, stage, deal_value, created_at')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false }),
    ]);

    return {
      messages: messages || [],
      notes: notes || [],
      leads: leads || [],
    };
  }
}
