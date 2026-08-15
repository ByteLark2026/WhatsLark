import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';
import { normalizeUrl } from '../normalize-url.util';

/**
 * WooCommerce REST API v3 (https://woocommerce.github.io/woocommerce-rest-api-docs/).
 * config: { storeUrl } — e.g. https://shop.example.com
 * credentials: { consumerKey, consumerSecret } — sent as HTTP Basic auth.
 */
export class WooCommerceErpAdapter implements ErpAdapter {
  readonly provider = 'woocommerce';

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  private authHeader(): Record<string, string> {
    const token = Buffer.from(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`).toString('base64');
    return { Authorization: `Basic ${token}`, Accept: 'application/json' };
  }

  private toProduct(raw: any): ErpProduct {
    return {
      sku: raw.sku || String(raw.id),
      name: raw.name,
      stock: typeof raw.stock_quantity === 'number' ? raw.stock_quantity : null,
      cost: null, // WooCommerce core has no cost-price field without an extension
      price: raw.price ? Number(raw.price) : null,
      currency: raw.currency || 'AED',
    };
  }

  async getProduct(sku: string): Promise<ErpProduct | null> {
    const results = await this.searchProducts(sku, 1);
    return results.find((p) => p.sku === sku) ?? results[0] ?? null;
  }

  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    try {
      const url = new URL(`${normalizeUrl(this.config.storeUrl)}/wp-json/wc/v3/products`);
      url.searchParams.set('search', query);
      url.searchParams.set('per_page', String(limit));
      const res = await fetch(url.toString(), { headers: this.authHeader() });
      if (!res.ok) return [];
      const items = await res.json();
      return Array.isArray(items) ? items.map((item: any) => this.toProduct(item)) : [];
    } catch {
      return [];
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const product = await this.getProduct(sku);
    return product?.stock ?? null;
  }
}
