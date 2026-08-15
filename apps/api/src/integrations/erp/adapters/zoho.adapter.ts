import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Zoho Inventory REST API, OAuth2 refresh-token flow.
 * config: { organizationId, accountsDomain? (default accounts.zoho.com),
 *           apiDomain? (default www.zohoapis.com) } — use the region-matched
 *           domains (.eu/.in/.com.au/...) for non-US Zoho orgs.
 * credentials: { clientId, clientSecret, refreshToken } — obtained once via
 * Zoho's OAuth consent flow outside this app; refreshToken doesn't expire
 * unless revoked.
 * Untested against a live Zoho org — no sandbox was available — but
 * implemented directly against Zoho's documented API contract
 * (https://www.zoho.com/inventory/api/v1/).
 */
export class ZohoErpAdapter implements ErpAdapter {
  readonly provider = 'zoho';
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) return this.tokenCache.token;

    const accountsDomain = this.config.accountsDomain || 'accounts.zoho.com';
    const res = await fetch(`https://${accountsDomain}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Zoho auth failed (${res.status})`);
    const json = await res.json();
    if (!json.access_token) throw new Error(json.error || 'Zoho auth failed');
    this.tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
    return json.access_token;
  }

  private apiDomain(): string {
    return this.config.apiDomain || 'www.zohoapis.com';
  }

  private toProduct(raw: any): ErpProduct {
    return {
      sku: raw.sku || String(raw.item_id),
      name: raw.name,
      stock: typeof raw.stock_on_hand === 'number' ? raw.stock_on_hand : null,
      cost: typeof raw.purchase_rate === 'number' ? raw.purchase_rate : null,
      price: typeof raw.rate === 'number' ? raw.rate : null,
      currency: this.config.currency || 'AED',
    };
  }

  async getProduct(sku: string): Promise<ErpProduct | null> {
    try {
      const token = await this.getAccessToken();
      const url = new URL(`https://${this.apiDomain()}/inventory/v1/items`);
      url.searchParams.set('organization_id', this.config.organizationId);
      url.searchParams.set('sku', sku);
      const res = await fetch(url.toString(), { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (!res.ok) return null;
      const { items } = await res.json();
      return items?.[0] ? this.toProduct(items[0]) : null;
    } catch {
      return null;
    }
  }

  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    try {
      const token = await this.getAccessToken();
      const url = new URL(`https://${this.apiDomain()}/inventory/v1/items`);
      url.searchParams.set('organization_id', this.config.organizationId);
      url.searchParams.set('search_text', query);
      url.searchParams.set('per_page', String(limit));
      const res = await fetch(url.toString(), { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (!res.ok) return [];
      const { items } = await res.json();
      return (items || []).map((item: any) => this.toProduct(item));
    } catch {
      return [];
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const product = await this.getProduct(sku);
    return product?.stock ?? null;
  }
}
