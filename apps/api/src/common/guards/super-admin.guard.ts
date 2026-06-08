import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');

    const { data } = await this.supabase.getAdminClient()
      .from('users')
      .select('is_super_admin')
      .eq('id', userId)
      .single();

    if (!data?.is_super_admin) throw new ForbiddenException('Super admin only');
    return true;
  }
}
