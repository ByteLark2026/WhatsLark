import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Odoo (JSON-RPC over /jsonrpc, product.product model). Stubbed — needs a real
 * Odoo instance + database name + API key to test the RPC call shape and auth
 * against. Swap method bodies for real /jsonrpc calls (execute_kw on
 * product.product: search_read with fields ['default_code','name','qty_available',
 * 'standard_price','lst_price']) once available.
 */
export class OdooErpAdapter implements ErpAdapter {
  readonly provider = 'odoo';

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  async getProduct(_sku: string): Promise<ErpProduct | null> {
    throw new Error('Odoo adapter not yet implemented — connect and test against a real Odoo instance first');
  }

  async searchProducts(_query: string, _limit?: number): Promise<ErpProduct[]> {
    throw new Error('Odoo adapter not yet implemented — connect and test against a real Odoo instance first');
  }

  async getStock(_sku: string): Promise<number | null> {
    throw new Error('Odoo adapter not yet implemented — connect and test against a real Odoo instance first');
  }
}
