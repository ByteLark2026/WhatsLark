import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { InvoicesService, LineItem } from '../invoices/invoices.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { shareDocumentViaWhatsApp } from '../common/document-whatsapp.util';

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
    private readonly whatsapp: WhatsAppService,
  ) {}

  private async nextNumber(companyId: string): Promise<string> {
    const { count } = await this.supabase.getAdminClient()
      .from('quotations').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
    return `QUO-${String((count || 0) + 1).padStart(4, '0')}`;
  }

  async list(companyId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const { status } = opts;
    const page = opts.page || 1;
    const limit = opts.limit || 50;
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
    const lineItems = dto.line_items || [];
    const totals = calcTotals(lineItems, dto.tax_rate || 0, dto.discount || 0);

    let data: any, error: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const number = await this.nextNumber(companyId);
      ({ data, error } = await this.supabase.getAdminClient()
        .from('quotations')
        .insert({
          company_id: companyId, created_by: userId, number,
          line_items: lineItems, tax_rate: dto.tax_rate || 0, discount: dto.discount || 0,
          currency: dto.currency || 'AED', valid_until: dto.valid_until,
          notes: dto.notes, terms: dto.terms,
          contact_id: dto.contact_id, lead_id: dto.lead_id, ...totals,
        }).select().single());
      if (!error || error.code !== '23505') break;
    }
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
    const quote = await this.get(companyId, id);
    if (quote.requires_approval && !quote.approved_at) {
      throw new BadRequestException('This quotation is below the minimum margin and needs manager approval before it can be sent');
    }
    return this.update(companyId, id, { status: 'sent', sent_at: new Date().toISOString() });
  }

  async approvePricing(companyId: string, id: string, approverId: string, note?: string) {
    const quote = await this.get(companyId, id);
    if (!quote.requires_approval) throw new BadRequestException('This quotation does not require pricing approval');

    await this.supabase.getAdminClient()
      .from('quotation_approvals')
      .insert({ quotation_id: id, company_id: companyId, approver_id: approverId, status: 'approved', note });

    return this.update(companyId, id, { approved_by: approverId, approved_at: new Date().toISOString() });
  }

  async rejectPricing(companyId: string, id: string, approverId: string, note?: string) {
    await this.supabase.getAdminClient()
      .from('quotation_approvals')
      .insert({ quotation_id: id, company_id: companyId, approver_id: approverId, status: 'rejected', note });
    return this.get(companyId, id);
  }

  async sendWhatsApp(companyId: string, userId: string, id: string) {
    const quote = await this.get(companyId, id);
    await shareDocumentViaWhatsApp(this.supabase, this.whatsapp, {
      companyId,
      senderId: userId,
      contact: quote.contacts,
      docType: 'quotation',
      docNumber: quote.number,
      total: quote.total,
      currency: quote.currency,
      publicToken: quote.public_token,
    });
    if (quote.status === 'draft') return this.send(companyId, id);
    return quote;
  }

  async accept(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'accepted', accepted_at: new Date().toISOString() });
  }

  async reject(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'rejected', rejected_at: new Date().toISOString() });
  }

  async convertToInvoice(companyId: string, userId: string, id: string) {
    const quote = await this.get(companyId, id);
    if (quote.status === 'converted') throw new BadRequestException('Quotation already converted');

    // Atomic claim: only succeeds for the first concurrent caller, since Postgres
    // serializes UPDATEs to the same row — the loser's WHERE status != 'converted' matches 0 rows.
    const { data: claimed } = await this.supabase.getAdminClient()
      .from('quotations')
      .update({ status: 'converted' })
      .eq('id', id)
      .eq('company_id', companyId)
      .neq('status', 'converted')
      .select()
      .maybeSingle();
    if (!claimed) throw new BadRequestException('Quotation already converted');

    try {
      const invoice = await this.invoices.create(companyId, userId, {
        contact_id: quote.contact_id,
        lead_id: quote.lead_id,
        line_items: quote.line_items,
        tax_rate: quote.tax_rate,
        discount: quote.discount,
        currency: quote.currency,
        notes: quote.notes,
      });
      await this.update(companyId, id, { converted_invoice_id: invoice.id });
      return invoice;
    } catch (err) {
      // Release the claim so the quotation isn't stuck "converted" with no invoice.
      await this.supabase.getAdminClient()
        .from('quotations').update({ status: quote.status }).eq('id', id);
      throw err;
    }
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
