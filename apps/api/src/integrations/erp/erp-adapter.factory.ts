import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase.service';
import { decryptToken } from '../../common/token-crypto.util';
import { ErpAdapter } from './erp-adapter.interface';
import { CustomRestErpAdapter } from './adapters/custom-rest.adapter';
import { WooCommerceErpAdapter } from './adapters/woocommerce.adapter';
import { ShopifyErpAdapter } from './adapters/shopify.adapter';
import { BusinessCentralErpAdapter } from './adapters/business-central.adapter';
import { OdooErpAdapter } from './adapters/odoo.adapter';
import { ZohoErpAdapter } from './adapters/zoho.adapter';

@Injectable()
export class ErpAdapterFactory {
  constructor(private readonly supabase: SupabaseService) {}

  /** Resolves the active integration_connections row for a company and returns a ready-to-use adapter, or null if none configured. */
  async getAdapter(companyId: string): Promise<ErpAdapter | null> {
    const { data: conn } = await this.supabase.getAdminClient()
      .from('integration_connections')
      .select('provider, config, credentials')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();
    if (!conn) return null;

    const config = conn.config || {};
    let credentials: Record<string, string> = {};
    if (conn.credentials) {
      try {
        credentials = JSON.parse(decryptToken(conn.credentials));
      } catch {
        return null;
      }
    }

    switch (conn.provider) {
      case 'custom_rest': return new CustomRestErpAdapter(config, credentials);
      case 'woocommerce': return new WooCommerceErpAdapter(config, credentials);
      case 'shopify': return new ShopifyErpAdapter(config, credentials);
      case 'business_central': return new BusinessCentralErpAdapter(config, credentials);
      case 'odoo': return new OdooErpAdapter(config, credentials);
      case 'zoho': return new ZohoErpAdapter(config, credentials);
      default: return null;
    }
  }
}
