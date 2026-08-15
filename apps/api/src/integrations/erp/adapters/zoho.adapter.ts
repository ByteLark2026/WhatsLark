import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Zoho Inventory/Books REST API. Needs a Zoho OAuth app (client id/secret) and a
 * per-tenant refresh-token exchange flow — not wired yet. Stubbed; swap method
 * bodies for real calls against https://www.zohoapis.com/inventory/v1/items once
 * the OAuth flow and a real Zoho org are available to test against.
 */
export class ZohoErpAdapter implements ErpAdapter {
  readonly provider = 'zoho';

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  async getProduct(_sku: string): Promise<ErpProduct | null> {
    throw new Error('Zoho adapter not yet implemented — needs OAuth refresh-token flow against a real Zoho org first');
  }

  async searchProducts(_query: string, _limit?: number): Promise<ErpProduct[]> {
    throw new Error('Zoho adapter not yet implemented — needs OAuth refresh-token flow against a real Zoho org first');
  }

  async getStock(_sku: string): Promise<number | null> {
    throw new Error('Zoho adapter not yet implemented — needs OAuth refresh-token flow against a real Zoho org first');
  }
}
