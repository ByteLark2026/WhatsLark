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
    // WooCommerce's `search` param (used by searchProducts) matches title/content text,
    // not the sku field — a SKU found via name search often can't be re-confirmed that
    // way. `sku` is a separate, exact-match filter on the same endpoint.
    try {
      const url = new URL(`${normalizeUrl(this.config.storeUrl)}/wp-json/wc/v3/products`);
      url.searchParams.set('sku', sku);
      const res = await fetch(url.toString(), { headers: this.authHeader() });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items[0]) return this.toProduct(items[0]);
      }

      // Products without an assigned WooCommerce SKU get toProduct()'s numeric-id
      // fallback as their "sku" (so they're still pickable in the RFQ item search) —
      // the sku= filter can never find those, so retry as a direct product-id lookup.
      if (/^\d+$/.test(sku)) {
        const byIdRes = await fetch(`${normalizeUrl(this.config.storeUrl)}/wp-json/wc/v3/products/${sku}`, { headers: this.authHeader() });
        if (byIdRes.ok) {
          const product = await byIdRes.json();
          if (product?.id) return this.toProduct(product);
        }
      }
      return null;
    } catch {
      return null;
    }
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
