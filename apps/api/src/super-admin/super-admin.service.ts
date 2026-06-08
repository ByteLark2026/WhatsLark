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
      .select('*', { count: 'exact' })
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
      { count: totalUsers },
      { count: totalMessages },
      { count: activeCompanies },
    ] = await Promise.all([
      this.supabase.getAdminClient().from('companies').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('users').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('messages').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    return { total_companies: totalCompanies, total_users: totalUsers, total_messages: totalMessages, active_companies: activeCompanies };
  }
}
