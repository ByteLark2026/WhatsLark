import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Odoo — JSON-RPC over /jsonrpc, product.product model via execute_kw.
 * config: { baseUrl (e.g. https://mycompany.odoo.com), db, username }
 * credentials: { apiKey } — Odoo 14+ accepts an API key in place of a password
 * for execute_kw calls, avoiding storing the user's real login password.
 * Untested against a live Odoo instance — no sandbox was available — but
 * implemented directly against Odoo's documented external API contract
 * (https://www.odoo.com/documentation/latest/developer/reference/external_api.html).
 */
export class OdooErpAdapter implements ErpAdapter {
  readonly provider = 'odoo';
  private uidCache: number | null = null;

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  private async rpc(service: string, method: string, args: any[]): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: Date.now(),
      }),
    });
    if (!res.ok) throw new Error(`Odoo RPC failed (${res.status})`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.data?.message || 'Odoo RPC error');
    return json.result;
  }

  private async getUid(): Promise<number> {
    if (this.uidCache != null) return this.uidCache;
    const uid = await this.rpc('common', 'login', [this.config.db, this.config.username, this.credentials.apiKey]);
    if (!uid) throw new Error('Odoo authentication failed');
    this.uidCache = uid;
    return uid;
  }

  private toProduct(raw: any): ErpProduct {
    return {
      sku: raw.default_code || String(raw.id),
      name: raw.name,
      stock: typeof raw.qty_available === 'number' ? raw.qty_available : null,
      cost: typeof raw.standard_price === 'number' ? raw.standard_price : null,
      price: typeof raw.lst_price === 'number' ? raw.lst_price : null,
      currency: this.config.currency || 'AED',
    };
  }

  private async searchRead(domain: any[], limit: number): Promise<any[]> {
    const uid = await this.getUid();
    return this.rpc('object', 'execute_kw', [
      this.config.db, uid, this.credentials.apiKey,
      'product.product', 'search_read',
      [domain],
      { fields: ['default_code', 'name', 'qty_available', 'standard_price', 'lst_price'], limit },
    ]);
  }

  async getProduct(sku: string): Promise<ErpProduct | null> {
    try {
      const results = await this.searchRead([['default_code', '=', sku]], 1);
      return results[0] ? this.toProduct(results[0]) : null;
    } catch {
      return null;
    }
  }

  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    try {
      const results = await this.searchRead([['name', 'ilike', query]], limit);
      return results.map((r) => this.toProduct(r));
    } catch {
      return [];
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const product = await this.getProduct(sku);
    return product?.stock ?? null;
  }
}
