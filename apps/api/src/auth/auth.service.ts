import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async register(dto: RegisterDto) {
    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await this.supabase
      .getAdminClient()
      .auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true, // skip email confirmation in dev
      });

    if (authError) throw new BadRequestException(authError.message);

    const userId = authData.user.id;

    // 2. Create user profile
    const { error: profileError } = await this.supabase.getAdminClient()
      .from('users')
      .insert({ id: userId, email: dto.email, full_name: dto.full_name });

    if (profileError) throw new BadRequestException(profileError.message);

    // 3. Create company/workspace
    const slug = this.generateSlug(dto.company_name);
    const { data: company, error: companyError } = await this.supabase
      .getAdminClient()
      .from('companies')
      .insert({
        name: dto.company_name,
        slug,
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (companyError) throw new BadRequestException(companyError.message);

    // 4. Add user as owner
    await this.supabase.getAdminClient().from('company_users').insert({
      company_id: company.id,
      user_id: userId,
      role: 'owner',
    });

    // 5. Create default subscription
    await this.supabase.getAdminClient().from('subscriptions').insert({
      company_id: company.id,
      plan: 'free',
      status: 'trialing',
      current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // 6. Create default AI settings
    await this.supabase.getAdminClient().from('ai_settings').insert({
      company_id: company.id,
    });

    // 7. Sign in to get tokens
    const { data: session, error: signInError } = await this.supabase
      .getClient()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    if (signInError) throw new BadRequestException(signInError.message);

    return {
      user: { id: userId, email: dto.email, full_name: dto.full_name },
      company,
      session: session.session,
    };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase
      .getClient()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    if (error) throw new UnauthorizedException('Invalid credentials');

    // Get user profile + company
    const { data: profile } = await this.supabase.getAdminClient()
      .from('users')
      .select('*, company_users(company_id, role, companies(*))')
      .eq('id', data.user.id)
      .single();

    return { session: data.session, user: profile };
  }

  async logout(accessToken: string) {
    await this.supabase.getClientWithToken(accessToken).auth.signOut();
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const { error } = await this.supabase.getClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });
    if (error) throw new BadRequestException(error.message);
    return { message: 'Password reset email sent' };
  }

  async resetPassword(accessToken: string, newPassword: string) {
    const { error } = await this.supabase
      .getClientWithToken(accessToken)
      .auth.updateUser({ password: newPassword });
    if (error) throw new BadRequestException(error.message);
    return { message: 'Password updated successfully' };
  }

  async getProfile(userId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('users')
      .select(`
        *,
        company_users (
          role,
          company_id,
          companies (id, name, slug, status, plan, logo_url, timezone)
        )
      `)
      .eq('id', userId)
      .single();

    if (error) throw new UnauthorizedException('User not found');
    return data;
  }

  async updateProfile(userId: string, updates: { full_name?: string; avatar_url?: string }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private generateSlug(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}-${suffix}`;
  }
}
