import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class ProductCatalogService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('product_catalog')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async create(companyId: string, dto: { sku: string; name: string; aliases?: string[]; cost?: number; standard_price?: number; currency?: string }) {
    if (!dto.sku?.trim() || !dto.name?.trim()) throw new BadRequestException('sku and name are required');
    const { data, error } = await this.supabase.getAdminClient()
      .from('product_catalog')
      .insert({
        company_id: companyId,
        sku: dto.sku.trim(),
        name: dto.name.trim(),
        aliases: dto.aliases || [],
        cost: dto.cost ?? null,
        standard_price: dto.standard_price ?? null,
        currency: dto.currency || 'AED',
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new BadRequestException(`SKU "${dto.sku}" already exists`);
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async update(companyId: string, id: string, dto: Partial<{ sku: string; name: string; aliases: string[]; cost: number; standard_price: number; currency: string; is_active: boolean }>) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('product_catalog')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }

  async delete(companyId: string, id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('product_catalog')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async bulkImport(companyId: string, rows: { sku: string; name: string; aliases?: string[]; cost?: number; standard_price?: number; currency?: string }[]) {
    const valid = rows.filter((r) => r.sku?.trim() && r.name?.trim());
    if (!valid.length) throw new BadRequestException('No valid rows (sku and name are required on every row)');

    const { data, error } = await this.supabase.getAdminClient()
      .from('product_catalog')
      .upsert(
        valid.map((r) => ({
          company_id: companyId,
          sku: r.sku.trim(),
          name: r.name.trim(),
          aliases: r.aliases || [],
          cost: r.cost ?? null,
          standard_price: r.standard_price ?? null,
          currency: r.currency || 'AED',
        })),
        { onConflict: 'company_id,sku' },
      )
      .select();
    if (error) throw new BadRequestException(error.message);
    return { imported: data?.length || 0 };
  }
}
