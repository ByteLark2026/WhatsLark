import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

function calcTotals(lineItems: LineItem[], taxRate: number, discount: number) {
  const subtotal = lineItems.reduce((s, i) => s + (i.qty * i.unit_price), 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  return { subtotal, tax_amount: taxAmount, total: Math.max(0, total) };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly supabase: SupabaseService) {}

  private async nextNumber(companyId: string): Promise<string> {
    const { count } = await this.supabase.getAdminClient()
      .from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
    return `INV-${String((count || 0) + 1).padStart(4, '0')}`;
  }

  async list(companyId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;
    let query = this.supabase.getAdminClient()
      .from('invoices')
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
      .from('invoices')
      .select('*, contacts(id,name,phone,email), leads(id,title)')
      .eq('company_id', companyId).eq('id', id).single();
    if (error) throw new NotFoundException('Invoice not found');
    return data;
  }

  async getByToken(token: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('invoices')
      .select('*, contacts(id,name,phone,email), companies(name)')
      .eq('public_token', token).single();
    if (error) throw new NotFoundException('Invoice not found');
    return data;
  }

  async create(companyId: string, userId: string, dto: {
    contact_id?: string; lead_id?: string;
    line_items?: LineItem[]; tax_rate?: number;
    discount?: number; currency?: string;
    due_date?: string; notes?: string;
  }) {
    const number = await this.nextNumber(companyId);
    const lineItems = dto.line_items || [];
    const totals = calcTotals(lineItems, dto.tax_rate || 0, dto.discount || 0);
    const { data, error } = await this.supabase.getAdminClient()
      .from('invoices')
      .insert({
        company_id: companyId, created_by: userId, number,
        line_items: lineItems, tax_rate: dto.tax_rate || 0, discount: dto.discount || 0,
        currency: dto.currency || 'AED', due_date: dto.due_date, notes: dto.notes,
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
      .from('invoices').update(updates).eq('id', id).eq('company_id', companyId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async send(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'sent', sent_at: new Date().toISOString() });
  }

  async markPaid(companyId: string, id: string) {
    return this.update(companyId, id, { status: 'paid', paid_at: new Date().toISOString() });
  }

  async delete(companyId: string, id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('invoices').delete().eq('id', id).eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getStats(companyId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('invoices').select('status, total').eq('company_id', companyId);
    const all = data || [];
    return {
      total_invoices: all.length,
      draft: all.filter(i => i.status === 'draft').length,
      sent: all.filter(i => i.status === 'sent').length,
      paid: all.filter(i => i.status === 'paid').length,
      overdue: all.filter(i => i.status === 'overdue').length,
      total_paid: all.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0),
      total_outstanding: all.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0),
    };
  }
}
