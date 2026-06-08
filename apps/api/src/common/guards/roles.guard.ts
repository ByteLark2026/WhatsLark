import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const companyId = request.companyId; // set by CompanyMiddleware

    if (!userId || !companyId) throw new ForbiddenException('Missing context');

    const { data } = await this.supabase.getAdminClient()
      .from('company_users')
      .select('role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single();

    if (!data) throw new ForbiddenException('Not a member of this workspace');
    if (!requiredRoles.includes(data.role)) {
      throw new ForbiddenException(`Required role: ${requiredRoles.join(' or ')}`);
    }

    request.userRole = data.role;
    return true;
  }
}
