import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class SupportTicketsService {
  constructor(private readonly supabase: SupabaseService) {}

  private async getCompanyId(userId: string): Promise<string> {
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

  async list(userId: string, opts: { page?: number; limit?: number; status?: string } = {}) {
    const companyId = await this.getCompanyId(userId);
    const { page = 1, limit = 20, status } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async get(userId: string, id: string) {
    const companyId = await this.getCompanyId(userId);

    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*, support_ticket_replies(*, author:users(full_name, email))')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !data) throw new NotFoundException('Ticket not found');

    data.support_ticket_replies = (data.support_ticket_replies || []).filter(
      (r: any) => !r.is_internal_note,
    );
    return data;
  }

  async create(userId: string, dto: { subject: string; description: string; priority?: string }) {
    const companyId = await this.getCompanyId(userId);

    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .insert({
        company_id: companyId,
        user_id: userId,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority || 'medium',
        status: 'open',
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async addReply(userId: string, ticketId: string, message: string) {
    const companyId = await this.getCompanyId(userId);

    const { data: ticket, error: ticketError } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticketId)
      .eq('company_id', companyId)
      .single();
    if (ticketError || !ticket) throw new NotFoundException('Ticket not found');

    const { data, error } = await this.supabase.getAdminClient()
      .from('support_ticket_replies')
      .insert({
        ticket_id: ticketId,
        author_id: userId,
        message,
        is_internal_note: false,
      })
      .select('*, author:users(full_name, email)')
      .single();
    if (error) throw new BadRequestException(error.message);

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await this.supabase.getAdminClient()
        .from('support_tickets')
        .update({ status: 'open' })
        .eq('id', ticketId);
    }

    return data;
  }
}
