import { Controller, Post, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { RfqService } from './rfq.service';
import { ErpAdapterFactory } from '../integrations/erp/erp-adapter.factory';

/** Service-to-service only — called by the WhatsApp webhook process (a separate
 *  deployment, apps/web) right after it detects an RFQ. No human triggers these. */
@Controller('internal/rfq')
@UseGuards(InternalSecretGuard)
export class InternalRfqController {
  constructor(
    private readonly service: RfqService,
    private readonly erpAdapters: ErpAdapterFactory,
  ) {}

  @Post(':id/auto-quote')
  async autoQuote(@Param('id') id: string, @Body() dto: { company_id: string }) {
    if (!dto?.company_id) throw new BadRequestException('company_id is required');
    return this.service.generateQuote(dto.company_id, null, id);
  }

  /**
   * Lets the webhook's SKU matcher search a connected ERP's live catalog instead of
   * only the local product_catalog — the webhook (apps/web) has no direct access to
   * ErpAdapterFactory (different deployment), so this is the bridge. Returns
   * connected:false when no ERP is configured for the company, so the caller knows
   * to fall back to product_catalog matching instead.
   */
  @Post('erp-search')
  async erpSearch(@Body() dto: { company_id: string; query: string }) {
    if (!dto?.company_id) throw new BadRequestException('company_id is required');
    const adapter = await this.erpAdapters.getAdapter(dto.company_id).catch(() => null);
    if (!adapter) return { connected: false, results: [] };
    const results = await adapter.searchProducts(dto.query || '', 20).catch(() => []);
    return { connected: true, results };
  }
}
