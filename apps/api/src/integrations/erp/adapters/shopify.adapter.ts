import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Shopify Admin REST API. config: { shopDomain } — e.g. my-shop.myshopify.com,
 * { apiVersion } optional (defaults below). credentials: { accessToken }.
 */
export class ShopifyErpAdapter implements ErpAdapter {
  readonly provider = 'shopify';

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  private baseUrl(): string {
    const version = this.config.apiVersion || '2024-10';
    return `https://${this.config.shopDomain}/admin/api/${version}`;
  }

  private headers(): Record<string, string> {
    return { 'X-Shopify-Access-Token': this.credentials.accessToken, Accept: 'application/json' };
  }

  private toProduct(variant: any, productTitle: string): ErpProduct {
    return {
      sku: variant.sku || String(variant.id),
      name: productTitle,
      stock: typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : null,
      cost: null,
      price: variant.price ? Number(variant.price) : null,
      currency: this.config.currency || 'AED',
    };
  }

  async getProduct(sku: string): Promise<ErpProduct | null> {
    try {
      const url = new URL(`${this.baseUrl()}/products.json`);
      url.searchParams.set('limit', '250');
      const res = await fetch(url.toString(), { headers: this.headers() });
      if (!res.ok) return null;
      const { products } = await res.json();
      for (const product of products || []) {
        const variant = (product.variants || []).find((v: any) => v.sku === sku);
        if (variant) return this.toProduct(variant, product.title);
      }
      return null;
    } catch {
      return null;
    }
  }

  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    try {
      const url = new URL(`${this.baseUrl()}/products.json`);
      url.searchParams.set('title', query);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { headers: this.headers() });
      if (!res.ok) return [];
      const { products } = await res.json();
      const results: ErpProduct[] = [];
      for (const product of products || []) {
        for (const variant of product.variants || []) {
          results.push(this.toProduct(variant, product.title));
        }
      }
      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  async getStock(sku: string): Promise<number | null> {
    const product = await this.getProduct(sku);
    return product?.stock ?? null;
  }
}
