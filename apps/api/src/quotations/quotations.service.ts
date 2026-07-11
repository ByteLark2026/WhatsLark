import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { InvoicesService, LineItem } from '../invoices/invoices.service';

function calcTotals(lineItems: LineItem[], taxRate: number, discount: number) {
  const subtotal = lineItems.reduce((s, i) => s + (i.qty * i.unit_price), 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  return { subtotal, tax_amount: taxAmount, total: Math.max(0, total) };
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly invoices: InvoicesService,
  ) {}

  private async nextNumber(companyId: string): Promise<string> {
    const { count } = await this.supabase.getAdminClient()
      .from('quotations').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
    return `QUO-${String((count || 0) + 1).padStart(4, '0')}`;
  }

  async list(companyId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;
    let query = this.supabase.getAdminClient()
      .from('quotations')
      .select('*, contacts(id,name,phone)', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('quotations')
      .select('*, contacts(id,name,phone,email), leads(id,title)')
      .eq('company_id', companyId).eq('id', id).single();
    if (error) throw new NotFoundException('Quotation not found');
    return data;
  }

  async getByToken(token: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('quotations')
      .select('*, contacts(id,name,phone,email), companies(name)')
      .eq('public_token', token).single();
    if (error) throw new NotFoundException('Quotation not found');
    return data;
  }

  async create(companyId: string, userId: string, dto: any) {
    const number = await this.nextNumber(companyId);
    const lineItems = dto.line_items || [];
    const totals = calcTotals(lineItems, dto.tax_rate || 0, dto.discount || 0);
    const { data, error } = await this.supabase.getAdminClient()
      .from('quotations')
      .insert({
        company_id: companyId, created_by: userId, number,
        line_items: lineItems, tax_rate: dto.tax_rate || 0, discount: dto.discount || 0,
        currency: dto.currency || 'AED', valid_until: dto.valid_until,
        notes: dto.notes, terms: dto.terms,
        contact_id: dto.contact_id, lead_id: dto.lead_id, ...totals,
      }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const updates: any = { ...dto };
    if (dto.line_items !== undefined) {
      const totals = calcTotals(dto.line_items, dto.tax_rate ?? 0, dto.discount ?? 0);
      Object.assign(updates, totals);
    }
    const { data, error } = await this.supabase.getAdminClient()
      .from('quotations').update(updates).eq('id', id).eq('company_id', companyId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async send(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'sent', sent_at: new Date().toISOString() });
  }

  async accept(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'accepted', accepted_at: new Date().toISOString() });
  }

  async reject(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'rejected', rejected_at: new Date().toISOString() });
  }

  async convertToInvoice(companyId: string, userId: string, id: string) {
    const quote = await this.get(companyId, id);
    const invoice = await this.invoices.create(companyId, userId, {
      contact_id: quote.contact_id,
      lead_id: quote.lead_id,
      line_items: quote.line_items,
      tax_rate: quote.tax_rate,
      discount: quote.discount,
      currency: quote.currency,
      notes: quote.notes,
    });
    await this.update(companyId, id, { status: 'converted', converted_invoice_id: invoice.id });
    return invoice;
  }

  async delete(companyId: string, id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('quotations').delete().eq('id', id).eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getStats(companyId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('quotations').select('status, total').eq('company_id', companyId);
    const all = data || [];
    return {
      total: all.length,
      draft: all.filter(q => q.status === 'draft').length,
      sent: all.filter(q => q.status === 'sent').length,
      accepted: all.filter(q => q.status === 'accepted').length,
      rejected: all.filter(q => q.status === 'rejected').length,
      converted: all.filter(q => q.status === 'converted').length,
      total_value: all.filter(q => ['sent','accepted'].includes(q.status)).reduce((s, q) => s + (q.total || 0), 0),
    };
  }
}
