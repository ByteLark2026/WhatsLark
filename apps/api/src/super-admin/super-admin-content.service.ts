import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class SuperAdminContentService {
  constructor(private readonly supabase: SupabaseService) {}

  // ===================== Notifications =====================

  async listNotifications(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase.getAdminClient()
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async createNotification(dto: any) {
    const payload = { ...dto };
    if (payload.is_published && !payload.published_at) {
      payload.published_at = new Date().toISOString();
    }
    const { data, error } = await this.supabase.getAdminClient()
      .from('notifications')
      .insert(payload)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateNotification(id: string, dto: any) {
    const payload = { ...dto };
    if (payload.is_published && !payload.published_at) {
      payload.published_at = new Date().toISOString();
    }
    const { data, error } = await this.supabase.getAdminClient()
      .from('notifications')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteNotification(id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('notifications')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ===================== Subscription Plans =====================

  async listSubscriptionPlans() {
    const { data, error } = await this.supabase.getAdminClient()
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createSubscriptionPlan(dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('subscription_plans')
      .insert(dto)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateSubscriptionPlan(id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('subscription_plans')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteSubscriptionPlan(id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('subscription_plans')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ===================== Subscriptions Data (read-only) =====================

  async listSubscriptions(opts: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('subscriptions')
      .select('*, companies(name, slug, status)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  // ===================== Transactions =====================

  async listTransactions(opts: { page?: number; limit?: number; status?: string; company_id?: string } = {}) {
    const { page = 1, limit = 20, status, company_id } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('transactions')
      .select('*, companies(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (company_id) query = query.eq('company_id', company_id);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async createTransaction(dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('transactions')
      .insert(dto)
      .select('*, companies(name, slug)')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateTransaction(id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('transactions')
      .update(dto)
      .eq('id', id)
      .select('*, companies(name, slug)')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteTransaction(id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('transactions')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ===================== Support Tickets =====================

  async listSupportTickets(opts: { page?: number; limit?: number; status?: string; priority?: string } = {}) {
    const { page = 1, limit = 20, status, priority } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*, companies(name, slug), user:users!support_tickets_user_id_fkey(full_name, email), assignee:users!support_tickets_assigned_to_fkey(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async createSupportTicket(dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .insert({
        company_id: dto.company_id || null,
        user_id: dto.user_id || null,
        subject: dto.subject,
        description: dto.description,
        status: dto.status || 'open',
        priority: dto.priority || 'medium',
        assigned_to: dto.assigned_to || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getSupportTicket(id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*, companies(name, slug), user:users!support_tickets_user_id_fkey(full_name, email), assignee:users!support_tickets_assigned_to_fkey(full_name, email), support_ticket_replies(*, author:users(full_name, email))')
      .eq('id', id)
      .single();
    if (error) throw new NotFoundException(error.message);
    return data;
  }

  async updateSupportTicket(id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async addSupportTicketReply(ticketId: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('support_ticket_replies')
      .insert({ ...dto, ticket_id: ticketId })
      .select('*, author:users(full_name, email)')
      .single();
    if (error) throw new BadRequestException(error.message);

    if (!dto.is_internal_note) {
      await this.supabase.getAdminClient()
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticketId)
        .eq('status', 'open');
    }

    return data;
  }

  async deleteSupportTicket(id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ===================== App Versions =====================

  async listAppVersions(opts: { platform?: string } = {}) {
    let query = this.supabase.getAdminClient()
      .from('app_versions')
      .select('*')
      .order('platform', { ascending: true })
      .order('released_at', { ascending: false });

    if (opts.platform) query = query.eq('platform', opts.platform);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createAppVersion(dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('app_versions')
      .insert(dto)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateAppVersion(id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('app_versions')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteAppVersion(id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('app_versions')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ===================== Payment Gateway Settings =====================

  private maskSecret(value?: string | null) {
    if (!value) return null;
    const last4 = value.slice(-4);
    return `********${last4}`;
  }

  async listPaymentGatewaySettings() {
    const { data, error } = await this.supabase.getAdminClient()
      .from('payment_gateway_settings')
      .select('*')
      .order('provider', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    return (data || []).map((row: any) => {
      const { secret_key, webhook_secret, ...rest } = row;
      return {
        ...rest,
        secret_key_masked: this.maskSecret(secret_key),
        webhook_secret_masked: this.maskSecret(webhook_secret),
      };
    });
  }

  async upsertPaymentGatewaySettings(provider: string, dto: any) {
    const payload: any = { ...dto, provider };
    if (!payload.secret_key) delete payload.secret_key;
    if (!payload.webhook_secret) delete payload.webhook_secret;

    const { data: existing } = await this.supabase.getAdminClient()
      .from('payment_gateway_settings')
      .select('id')
      .eq('provider', provider)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await this.supabase.getAdminClient()
        .from('payment_gateway_settings')
        .update(payload)
        .eq('provider', provider)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      result = data;
    } else {
      const { data, error } = await this.supabase.getAdminClient()
        .from('payment_gateway_settings')
        .insert(payload)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      result = data;
    }

    const { secret_key, webhook_secret, ...rest } = result;
    return {
      ...rest,
      secret_key_masked: this.maskSecret(secret_key),
      webhook_secret_masked: this.maskSecret(webhook_secret),
    };
  }
}
