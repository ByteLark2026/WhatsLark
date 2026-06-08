import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async listTeam(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('company_users')
      .select('*, users (id, email, full_name, avatar_url, created_at)')
      .eq('company_id', companyId)
      .order('created_at');
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async invite(companyId: string, dto: { email: string; full_name: string; role: string }) {
    // Create auth user
    const { data: authData, error: authError } = await this.supabase.getAdminClient()
      .auth.admin.createUser({
        email: dto.email,
        email_confirm: true,
        password: Math.random().toString(36).slice(2) + 'Aa1!', // temp password — user must reset
      });

    if (authError) throw new BadRequestException(authError.message);

    const userId = authData.user.id;

    // Create profile
    await this.supabase.getAdminClient()
      .from('users')
      .insert({ id: userId, email: dto.email, full_name: dto.full_name });

    // Add to company
    const { data, error } = await this.supabase.getAdminClient()
      .from('company_users')
      .insert({ company_id: companyId, user_id: userId, role: dto.role })
      .select('*, users (id, email, full_name)')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateRole(companyId: string, userId: string, role: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('company_users')
      .update({ role })
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deactivate(companyId: string, userId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('company_users')
      .update({ is_active: false })
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
