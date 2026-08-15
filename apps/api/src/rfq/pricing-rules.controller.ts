import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PricingRulesService } from './pricing-rules.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('rfq/pricing-rules')
@UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
export class PricingRulesController {
  constructor(
    private readonly service: PricingRulesService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  @Get()
  @Roles('owner', 'admin', 'manager')
  async get(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.get(companyId);
  }

  @Put()
  @Roles('owner', 'admin')
  async upsert(@Request() req: any, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.upsert(companyId, dto);
  }
}
