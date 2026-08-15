import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { ProductCatalogService } from './product-catalog.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('rfq/products')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class ProductCatalogController {
  constructor(
    private readonly service: ProductCatalogService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  @Get()
  async list(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.list(companyId);
  }

  @Post()
  async create(@Request() req: any, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.create(companyId, dto);
  }

  @Post('bulk')
  async bulkImport(@Request() req: any, @Body() dto: { rows: any[] }) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.bulkImport(companyId, dto.rows || []);
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.delete(companyId, id);
  }
}
