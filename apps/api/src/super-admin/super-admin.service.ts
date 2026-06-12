import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class SuperAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCompanies(opts: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('companies')
      .select(`
        *,
        subscriptions (plan, status, current_period_end),
        company_users (count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async getCompany(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('companies')
      .select(`
        *,
        subscriptions (*),
        company_users (count),
        contacts (count),
        campaigns (count)
      `)
      .eq('id', companyId)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async setCompanyStatus(companyId: string, status: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('companies')
      .update({ status })
      .eq('id', companyId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listUsers(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase.getAdminClient()
      .from('users')
      .select('*, company_users(role, companies(name, slug))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async getUsage(companyId: string) {
    const [
      { count: contacts },
      { count: messages },
      { count: campaigns },
      { count: users },
    ] = await Promise.all([
      this.supabase.getAdminClient().from('contacts').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      this.supabase.getAdminClient().from('messages').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      this.supabase.getAdminClient().from('campaigns').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      this.supabase.getAdminClient().from('company_users').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    ]);

    return { contacts, messages, campaigns, users };
  }

  async getPlatformStats() {
    const [
      { count: totalCompanies },
      { count: activeCompanies },
      { count: totalUsers },
      { count: totalConversations },
      { count: totalCampaigns },
      { count: totalChannels },
      { count: totalMessages },
      { data: planRows },
    ] = await Promise.all([
      this.supabase.getAdminClient().from('companies').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      this.supabase.getAdminClient().from('users').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('conversations').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('campaigns').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('whatsapp_channels').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('messages').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('companies').select('plan'),
    ]);

    const plan_breakdown = (planRows || []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.plan] = (acc[r.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_companies: totalCompanies,
      active_companies: activeCompanies,
      total_users: totalUsers,
      total_conversations: totalConversations,
      total_campaigns: totalCampaigns,
      total_channels: totalChannels,
      total_messages: totalMessages,
      plan_breakdown,
    };
  }

  async listChannels(opts: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 20, search } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('whatsapp_channels')
      .select('id, name, phone_number, is_active, created_at, company_id, companies(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async listAllCampaigns(opts: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('campaigns')
      .select('*, companies(name, slug), message_templates(name), whatsapp_channels(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async listAllTemplates(opts: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('message_templates')
      .select('*, companies(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async listAllContacts(opts: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 50, search } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('contacts')
      .select('id, name, phone, email, is_blocked, created_at, company_id, companies(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async listMessageLogs(opts: { page?: number; limit?: number; status?: string; direction?: string } = {}) {
    const { page = 1, limit = 50, status, direction } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('messages')
      .select('id, content, direction, type, status, created_at, company_id, companies(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (direction) query = query.eq('direction', direction);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async getPlatformAnalytics(opts: { range?: string; from?: string; to?: string } = {}) {
    const { range = '30d', from, to } = opts;

    let since: string;
    let until: string | undefined;
    if (from) {
      since = new Date(from).toISOString();
      until = to ? new Date(to).toISOString() : undefined;
    } else {
      const days = range === '7d' ? 7 : range === '3m' ? 90 : 30;
      since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    }

    let messagesQuery = this.supabase.getAdminClient()
      .from('messages')
      .select('created_at, status, direction')
      .gte('created_at', since)
      .limit(5000);
    if (until) messagesQuery = messagesQuery.lte('created_at', until);

    const [{ data: messages, error: msgErr }, { data: campaigns, error: campErr }, { count: contactCount, error: ctErr }] = await Promise.all([
      messagesQuery,
      this.supabase.getAdminClient()
        .from('campaigns')
        .select('status, total_recipients, sent_count, delivered_count, read_count, failed_count, replied_count'),
      this.supabase.getAdminClient().from('contacts').select('*', { count: 'exact', head: true }),
    ]);

    if (msgErr) throw new BadRequestException(msgErr.message);
    if (campErr) throw new BadRequestException(campErr.message);
    if (ctErr) throw new BadRequestException(ctErr.message);

    return { messages, campaigns, contact_count: contactCount };
  }
}
