import { ErpAdapter, ErpProduct, ErpConnectionConfig, ErpConnectionCredentials } from '../erp-adapter.interface';

/**
 * Microsoft Dynamics 365 Business Central. Requires an Azure AD app registration
 * (OAuth2 client-credentials flow) plus the target company's BC environment/company
 * ID — none of which exist yet for any tenant. Stubbed so the adapter registry and
 * connection UI can be wired end-to-end now; swap the method bodies for real calls
 * against https://api.businesscentral.dynamics.com/v2.0/{tenant}/{env}/api/v2.0/companies({id})/items
 * once a real BC tenant is available to test against.
 */
export class BusinessCentralErpAdapter implements ErpAdapter {
  readonly provider = 'business_central';

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly credentials: ErpConnectionCredentials,
  ) {}

  async getProduct(_sku: string): Promise<ErpProduct | null> {
    throw new Error('Business Central adapter not yet implemented — connect and test against a real BC tenant first');
  }

  async searchProducts(_query: string, _limit?: number): Promise<ErpProduct[]> {
    throw new Error('Business Central adapter not yet implemented — connect and test against a real BC tenant first');
  }

  async getStock(_sku: string): Promise<number | null> {
    throw new Error('Business Central adapter not yet implemented — connect and test against a real BC tenant first');
  }
}
