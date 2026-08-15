import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { encryptToken } from '../../common/token-crypto.util';
import { ErpProviderType, ErpConnectionConfig, ErpConnectionCredentials } from './erp-adapter.interface';

const PROVIDERS: ErpProviderType[] = ['business_central', 'odoo', 'woocommerce', 'shopify', 'zoho', 'custom_rest'];

@Injectable()
export class IntegrationConnectionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('integration_connections')
      .select('id, provider, name, config, is_active, created_at, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data; // credentials never returned
  }

  async upsert(companyId: string, dto: { provider: string; name?: string; config?: ErpConnectionConfig; credentials?: ErpConnectionCredentials }) {
    if (!PROVIDERS.includes(dto.provider as ErpProviderType)) {
      throw new BadRequestException(`Unknown provider: ${dto.provider}`);
    }
    const row: Record<string, any> = {
      company_id: companyId,
      provider: dto.provider,
      name: dto.name || '',
      config: dto.config || {},
      is_active: true,
    };
    if (dto.credentials) row.credentials = encryptToken(JSON.stringify(dto.credentials));

    const { data, error } = await this.supabase.getAdminClient()
      .from('integration_connections')
      .upsert(row, { onConflict: 'company_id,provider' })
      .select('id, provider, name, config, is_active, created_at, updated_at')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deactivate(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('integration_connections')
      .update({ is_active: false })
      .eq('company_id', companyId)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Connection not found');
    return { success: true };
  }
}
