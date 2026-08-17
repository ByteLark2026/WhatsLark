import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { ProductAliasService } from './product-alias.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('rfq/aliases')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class ProductAliasController {
  constructor(
    private readonly service: ProductAliasService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('generate')
  async generate(@Request() req: any) {
    const companyId = await resolveCompanyId(this.supabase.getAdminClient(), req.user.id);
    return this.service.generateForCompany(companyId);
  }
}
