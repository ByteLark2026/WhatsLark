import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../supabase.service';

/**
 * Attaches the user's active company_id to every request.
 * Reads from: ?company_id query param OR X-Company-Id header OR first company in membership.
 */
@Injectable()
export class CompanyMiddleware implements NestMiddleware {
  constructor(private readonly supabase: SupabaseService) {}

  async use(req: Request & { user?: any; companyId?: string }, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    if (!userId) return next();

    const requestedId = (req.query.company_id as string) || (req.headers['x-company-id'] as string);

    const { data } = await this.supabase.getAdminClient()
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq(requestedId ? 'company_id' : 'is_active', requestedId || true)
      .limit(1)
      .single();

    if (data) req.companyId = data.company_id;
    next();
  }
}
