import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { QuotationsService } from '../quotations/quotations.service';
import { PricingRulesService } from './pricing-rules.service';
import { ErpAdapterFactory } from '../integrations/erp/erp-adapter.factory';
import { LineItem } from '../invoices/invoices.service';

@Injectable()
export class RfqService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly quotations: QuotationsService,
    private readonly pricingRules: PricingRulesService,
    private readonly erpAdapters: ErpAdapterFactory,
  ) {}

  async list(companyId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const offset = (page - 1) * limit;
    let query = this.supabase.getAdminClient()
      .from('rfqs')
      .select('*, contacts(id,name,phone)', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async get(companyId: string, id: string) {
    const { data: rfq, error } = await this.supabase.getAdminClient()
      .from('rfqs')
      .select('*, contacts(id,name,phone,email)')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();
    if (error || !rfq) throw new NotFoundException('RFQ not found');

    const { data: items } = await this.supabase.getAdminClient()
      .from('rfq_items')
      .select('*, product_catalog(id,sku,name,cost,standard_price,currency)')
      .eq('rfq_id', id)
      .order('created_at', { ascending: true });

    return { ...rfq, items: items || [] };
  }

  /** Human correction — assigns/reassigns the matched product for an item, or clears it. */
  async updateItem(companyId: string, rfqId: string, itemId: string, dto: { matched_product_id?: string | null; quantity?: number; unit?: string }) {
    const updates: Record<string, any> = {};

    if (dto.matched_product_id !== undefined) {
      if (dto.matched_product_id === null) {
        updates.matched_product_id = null;
        updates.matched_sku = null;
        updates.confidence = null;
        updates.status = 'unmatched';
      } else {
        const { data: product } = await this.supabase.getAdminClient()
          .from('product_catalog')
          .select('id, sku')
          .eq('company_id', companyId)
          .eq('id', dto.matched_product_id)
          .maybeSingle();
        if (!product) throw new BadRequestException('Product not found for this company');
        updates.matched_product_id = product.id;
        updates.matched_sku = product.sku;
        updates.confidence = 100; // human-confirmed
        updates.status = 'auto_matched';
      }
    }
    if (dto.quantity !== undefined) updates.quantity = dto.quantity;
    if (dto.unit !== undefined) updates.unit = dto.unit;

    const { data, error } = await this.supabase.getAdminClient()
      .from('rfq_items')
      .update(updates)
      .eq('id', itemId)
      .eq('rfq_id', rfqId)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('RFQ item not found');
    return data;
  }

  /**
   * Builds a quotation draft from the RFQ's matched items. Price/cost/stock come from
   * the tenant's connected ERP when one exists (ErpAdapterFactory), falling back to
   * the local product_catalog otherwise — never the LLM, per the RFQ agent's core
   * commercial-safety rule. Refuses if any item is still unmatched: a human must
   * resolve every line first.
   */
  async generateQuote(companyId: string, userId: string, rfqId: string) {
    const rfq = await this.get(companyId, rfqId);
    if (rfq.status === 'quoted') throw new BadRequestException('RFQ already has a quotation');

    const unresolved = rfq.items.filter((i: any) => i.status === 'unmatched' || !i.matched_product_id);
    if (unresolved.length > 0) {
      throw new BadRequestException(`Resolve ${unresolved.length} unmatched item(s) before generating a quote`);
    }

    const rules = await this.pricingRules.get(companyId);
    const adapter = await this.erpAdapters.getAdapter(companyId).catch(() => null);
    let requiresApproval = false;
    let currency = 'AED';

    const lineItems: LineItem[] = [];
    for (let idx = 0; idx < rfq.items.length; idx++) {
      const item = rfq.items[idx];
      let erpProduct: { stock: number | null; cost: number | null; price: number | null; currency: string } | null = null;
      if (adapter && item.matched_sku) {
        erpProduct = await adapter.getProduct(item.matched_sku).catch(() => null);
      }

      const qty = item.quantity ?? 1;
      const unitPrice = erpProduct?.price ?? item.product_catalog?.standard_price ?? 0;
      const cost = erpProduct?.cost ?? item.product_catalog?.cost ?? null;
      const stock = erpProduct?.stock ?? null;
      const name = item.product_catalog?.name || item.raw_text;
      if (erpProduct?.currency) currency = erpProduct.currency;
      else if (item.product_catalog?.currency) currency = item.product_catalog.currency;

      // Hard guardrail: never let a quote leave below cost, regardless of who generated it.
      if (rules.below_cost_block && cost != null && unitPrice < cost) {
        throw new BadRequestException(`"${name}" is priced below cost (${unitPrice} < ${cost}) — blocked by pricing guardrails`);
      }
      // Soft guardrails: under-margin or insufficient live ERP stock don't block generation,
      // they flag the quotation for manager approval instead.
      if (cost != null && unitPrice > 0) {
        const marginPct = ((unitPrice - cost) / unitPrice) * 100;
        if (marginPct < rules.min_margin_pct) requiresApproval = true;
      }
      if (stock != null && qty > stock) requiresApproval = true;

      lineItems.push({
        id: String(idx + 1),
        description: `${name}${item.unit ? ` (${item.unit})` : ''}`,
        qty,
        unit_price: unitPrice,
        amount: qty * unitPrice,
      });
    }

    const quotation = await this.quotations.create(companyId, userId, {
      contact_id: rfq.contact_id,
      line_items: lineItems,
      currency,
    });

    await this.supabase.getAdminClient()
      .from('quotations')
      .update({ rfq_id: rfqId, requires_approval: requiresApproval })
      .eq('id', quotation.id);

    await this.supabase.getAdminClient()
      .from('rfqs')
      .update({ status: 'quoted' })
      .eq('id', rfqId)
      .eq('company_id', companyId);

    let autoSendError: string | undefined;
    if (!requiresApproval) {
      const { data: settings } = await this.supabase.getAdminClient()
        .from('ai_settings')
        .select('rfq_auto_send')
        .eq('company_id', companyId)
        .maybeSingle();
      if (settings?.rfq_auto_send) {
        try {
          await this.quotations.sendWhatsApp(companyId, userId, quotation.id);
        } catch (err: any) {
          // Manual "Send to WhatsApp" in the quote builder still works — this just
          // means auto-send couldn't complete (no contact phone, window closed with
          // no approved template, etc).
          autoSendError = err.message;
        }
      }
    }

    return { ...quotation, rfq_id: rfqId, requires_approval: requiresApproval, auto_send_error: autoSendError };
  }
}
