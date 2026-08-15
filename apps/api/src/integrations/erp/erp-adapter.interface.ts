/**
 * Provider-agnostic product/inventory/pricing abstraction, per the RFQ agent's
 * "no hallucinated data" rule: stock, cost and price must always come from
 * here (the tenant's connected ERP/commerce system), never from the LLM.
 * Mirrors the shape of PaymentProvider (billing/providers) — one interface,
 * many adapters, resolved per-company at runtime by ErpAdapterFactory.
 */

export interface ErpProduct {
  sku: string;
  name: string;
  stock: number | null;
  cost: number | null;
  price: number | null;
  currency: string;
}

export interface ErpAdapter {
  readonly provider: string;

  /** Exact SKU lookup. Returns null if not found or on any adapter/connection failure. */
  getProduct(sku: string): Promise<ErpProduct | null>;

  /** Free-text search against the ERP's own catalogue, for cases the local product_catalog can't resolve. */
  searchProducts(query: string, limit?: number): Promise<ErpProduct[]>;

  /** Current stock only — cheaper than a full getProduct round-trip where supported. */
  getStock(sku: string): Promise<number | null>;
}

export type ErpProviderType = 'business_central' | 'odoo' | 'woocommerce' | 'shopify' | 'zoho' | 'custom_rest';

/** Non-secret, provider-specific settings — stored as-is in integration_connections.config. */
export type ErpConnectionConfig = Record<string, string>;

/** Provider-specific secrets — stored encrypted (as a JSON string) in integration_connections.credentials. */
export type ErpConnectionCredentials = Record<string, string>;
