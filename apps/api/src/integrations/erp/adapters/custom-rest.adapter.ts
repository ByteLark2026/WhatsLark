import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';
import { normalizeUrl } from '../normalize-url.util';

/**
 * Generic adapter for any REST API that exposes product lookup/search over HTTP.
 * config: { baseUrl, getProductPath ('/products/:sku'), searchPath ('/products') }
 * credentials: { apiKey } — sent as `Authorization: Bearer <apiKey>`.
 * Assumes the endpoint returns JSON shaped close to ErpProduct; unknown/missing
 * fields default to null rather than guessing.
 */
export class CustomRestErpAdapter implements ErpAdapter {
  readonly provider = 'custom_rest';

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.credentials.apiKey) headers.Authorization = `Bearer ${this.credentials.apiKey}`;
    return headers;
  }

  private toProduct(raw: any): ErpProduct | null {
    if (!raw?.sku) return null;
    return {
      sku: String(raw.sku),
      name: raw.name ?? raw.title ?? raw.sku,
      stock: raw.stock ?? raw.stock_quantity ?? null,
      cost: raw.cost ?? null,
      price: raw.price ?? raw.selling_price ?? null,
      currency: raw.currency ?? 'AED',
    };
  }

  async getProduct(sku: string): Promise<ErpProduct | null> {
    const path = (this.config.getProductPath || '/products/:sku').replace(':sku', encodeURIComponent(sku));
    try {
      const res = await fetch(`${normalizeUrl(this.config.baseUrl)}${path}`, { headers: this.headers() });
      if (!res.ok) return null;
      return this.toProduct(await res.json());
    } catch {
      return null;
    }
  }

  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    const path = this.config.searchPath || '/products';
    try {
      const url = new URL(`${normalizeUrl(this.config.baseUrl)}${path}`);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { headers: this.headers() });
      if (!res.ok) return [];
      const json = await res.json();
      const items = Array.isArray(json) ? json : json.items || json.data || [];
      return items.map((item: any) => this.toProduct(item)).filter((p: ErpProduct | null): p is ErpProduct => !!p);
    } catch {
      return [];
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const product = await this.getProduct(sku);
    return product?.stock ?? null;
  }
}
