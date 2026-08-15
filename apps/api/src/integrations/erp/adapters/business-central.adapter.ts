import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Microsoft Dynamics 365 Business Central — standard "items" API (v2.0), OAuth2
 * client-credentials flow against Azure AD.
 * config: { tenantId, environment (e.g. 'production'), companyId, apiVersion? }
 * credentials: { clientId, clientSecret }
 * Untested against a live BC tenant — no sandbox was available — but implemented
 * directly against Microsoft's documented contract:
 *   Token:  POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
 *   Items:  GET  https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{environment}
 *                /api/v2.0/companies({companyId})/items
 * Verify field names (unitPrice/unitCost/inventory) against the target environment
 * before relying on it in production — BC field availability can vary by version/localization.
 */
export class BusinessCentralErpAdapter implements ErpAdapter {
  readonly provider = 'business_central';
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) return this.tokenCache.token;

    const res = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        scope: 'https://api.businesscentral.dynamics.com/.default',
      }),
    });
    if (!res.ok) throw new Error(`Business Central auth failed (${res.status})`);
    const json = await res.json();
    this.tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
    return json.access_token;
  }

  private baseUrl(): string {
    const version = this.config.apiVersion || 'v2.0';
    return `https://api.businesscentral.dynamics.com/${version}/${this.config.tenantId}/${this.config.environment}/api/${version}/companies(${this.config.companyId})`;
  }

  private toProduct(raw: any): ErpProduct {
    return {
      sku: raw.number,
      name: raw.displayName,
      stock: typeof raw.inventory === 'number' ? raw.inventory : null,
      cost: typeof raw.unitCost === 'number' ? raw.unitCost : null,
      price: typeof raw.unitPrice === 'number' ? raw.unitPrice : null,
      currency: this.config.currency || 'AED',
    };
  }

  async getProduct(sku: string): Promise<ErpProduct | null> {
    try {
      const token = await this.getAccessToken();
      const url = new URL(`${this.baseUrl()}/items`);
      url.searchParams.set('$filter', `number eq '${sku.replace(/'/g, "''")}'`);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const { value } = await res.json();
      return value?.[0] ? this.toProduct(value[0]) : null;
    } catch {
      return null;
    }
  }

  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    try {
      const token = await this.getAccessToken();
      const url = new URL(`${this.baseUrl()}/items`);
      url.searchParams.set('$filter', `contains(displayName,'${query.replace(/'/g, "''")}')`);
      url.searchParams.set('$top', String(limit));
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      const { value } = await res.json();
      return (value || []).map((item: any) => this.toProduct(item));
    } catch {
      return [];
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const product = await this.getProduct(sku);
    return product?.stock ?? null;
  }
}
