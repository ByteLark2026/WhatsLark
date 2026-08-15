import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { ProductCatalogService } from './product-catalog.service';
import { ErpAdapterFactory } from '../integrations/erp/erp-adapter.factory';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('rfq/products')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class ProductCatalogController {
  constructor(
    private readonly service: ProductCatalogService,
    private readonly supabase: SupabaseService,
    private readonly erpAdapters: ErpAdapterFactory,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  @Get()
  async list(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.list(companyId);
  }

  /**
   * What the RFQ review item-picker actually searches. When an ERP is connected it
   * searches the ERP's live catalog exclusively — matching the "ERP is sole source of
   * truth once connected" rule from quote generation, the picker can't offer manual
   * product_catalog rows that generateQuote would then refuse to use. No connection
   * configured falls back to the local product_catalog.
   */
  @Get('search')
  async search(@Request() req: any, @Query('q') q: string) {
    const companyId = await this.getCompanyId(req.user.id);
    const adapter = await this.erpAdapters.getAdapter(companyId).catch(() => null);

    if (adapter) {
      const results = await adapter.searchProducts(q || '', 20).catch(() => []);
      return results.map((p) => ({ source: 'erp' as const, sku: p.sku, name: p.name, price: p.price, stock: p.stock }));
    }

    const products = await this.service.list(companyId);
    const needle = (q || '').toLowerCase();
    return (products || [])
      .filter((p: any) => !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle))
      .slice(0, 20)
      .map((p: any) => ({ source: 'catalog' as const, id: p.id, sku: p.sku, name: p.name, price: p.standard_price, stock: null }));
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
