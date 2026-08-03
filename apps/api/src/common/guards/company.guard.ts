import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

/**
 * Resolves the caller's active company_id and attaches it to the request.
 * Must run after JwtAuthGuard (which sets request.user) — Nest executes
 * guards listed in @UseGuards in order, so always pair as:
 * @UseGuards(JwtAuthGuard, CompanyGuard)
 */
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) return true;

    const requestedId = (request.query?.company_id as string) || (request.headers?.['x-company-id'] as string);

    const { data } = await this.supabase.getAdminClient()
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq(requestedId ? 'company_id' : 'is_active', requestedId || true)
      .limit(1)
      .single();

    if (data) request.companyId = data.company_id;
    return true;
  }
}
