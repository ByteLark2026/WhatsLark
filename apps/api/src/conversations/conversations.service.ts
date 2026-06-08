import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string, filters: {
    status?: string;
    assigned_to?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, assigned_to, search, page = 1, limit = 30 } = filters;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('conversations')
      .select(`
        *,
        contacts (id, name, phone, avatar_url),
        users:assigned_to (id, full_name, avatar_url),
        whatsapp_channels:channel_id (id, name, phone_number)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    return { data, total: count, page, limit };
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('conversations')
      .select(`
        *,
        contacts (*),
        users:assigned_to (id, full_name, avatar_url),
        whatsapp_channels:channel_id (id, name, phone_number)
      `)
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Conversation not found');
    return data;
  }

  async assign(companyId: string, id: string, agentId: string | null) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('conversations')
      .update({ assigned_to: agentId })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateStatus(companyId: string, id: string, status: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('conversations')
      .update({ status, unread_count: 0 })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getMessages(companyId: string, conversationId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase.getAdminClient()
      .from('messages')
      .select('*, users:sender_id (id, full_name, avatar_url)', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async addNote(companyId: string, conversationId: string, userId: string, content: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('messages')
      .insert({
        conversation_id: conversationId,
        company_id: companyId,
        direction: 'outbound',
        type: 'note',
        content,
        status: 'sent',
        sender_id: userId,
        is_note: true,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async addTag(companyId: string, conversationId: string, tagId: string) {
    await this.supabase.getAdminClient()
      .from('conversation_tags')
      .upsert({ conversation_id: conversationId, tag_id: tagId });
    return { success: true };
  }

  async removeTag(companyId: string, conversationId: string, tagId: string) {
    await this.supabase.getAdminClient()
      .from('conversation_tags')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('tag_id', tagId);
    return { success: true };
  }

  async getTags(companyId: string, conversationId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('conversation_tags')
      .select('tags (*)')
      .eq('conversation_id', conversationId);
    return data?.map((r: any) => r.tags) || [];
  }
}
