import { BillingService } from '../billing.service';
import { BillingRepository } from '../billing.repository';
import { PaymentProvider } from '../providers/payment-provider.interface';

function mockRepo(overrides: Record<string, any> = {}) {
  return {
    getActiveSubscriptionForCompany: jest.fn().mockResolvedValue(null),
    getActivePriceById: jest.fn(),
    createPendingSubscription: jest.fn(),
    attachProviderSubscriptionId: jest.fn(),
    getSubscriptionById: jest.fn(),
    updateSubscription: jest.fn(),
    listActivePlans: jest.fn(),
    listActivePricesForPlans: jest.fn(),
    listPaymentsForCompany: jest.fn(),
    ...overrides,
  };
}

function mockProvider(overrides: Partial<jest.Mocked<PaymentProvider>> = {}): jest.Mocked<PaymentProvider> {
  return {
    name: 'razorpay',
    createSubscription: jest.fn(),
    fetchSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    pauseSubscription: jest.fn(),
    resumeSubscription: jest.fn(),
    changeSubscriptionPlan: jest.fn(),
    verifyCheckoutSignature: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    ...overrides,
  } as any;
}

const mockEntitlements = {} as any;
const mockSupabase = {} as any;

const ACTIVE_PRICE = {
  id: 'price-1',
  provider: 'razorpay',
  provider_plan_id: 'plan_test123',
  billing_interval: 'monthly',
  amount_minor: 99900,
  currency: 'INR',
  billing_plans: { id: 'plan-1', code: 'starter', name: 'Starter', active: true },
};

describe('BillingService.createSubscription', () => {
  it('rejects when the company already has an active/pending subscription (prevents duplicates)', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({ id: 'existing-sub', status: 'active' }),
    });
    const svc = new BillingService(repo as any, mockProvider(), mockEntitlements, mockSupabase);

    await expect(svc.createSubscription('user-1', 'company-1', 'price-1'))
      .rejects.toThrow(/already has an active or pending subscription/);
  });

  it('rejects an inactive/unknown billing_price_id (never trusts frontend amounts)', async () => {
    const repo = mockRepo({
      getActivePriceById: jest.fn().mockRejectedValue(new Error('Billing price not found or inactive')),
    });
    const svc = new BillingService(repo as any, mockProvider(), mockEntitlements, mockSupabase);

    await expect(svc.createSubscription('user-1', 'company-1', 'bad-price'))
      .rejects.toThrow(/not found or inactive/);
  });

  it('creates a pending local row, then a provider subscription, using the DB-loaded provider_plan_id (never a browser-supplied one)', async () => {
    const provider = mockProvider({
      createSubscription: jest.fn().mockResolvedValue({ providerSubscriptionId: 'sub_abc', status: 'created' }),
    });
    const repo = mockRepo({
      getActivePriceById: jest.fn().mockResolvedValue(ACTIVE_PRICE),
      createPendingSubscription: jest.fn().mockResolvedValue({ id: 'local-sub-1' }),
      attachProviderSubscriptionId: jest.fn().mockResolvedValue({ id: 'local-sub-1', provider_subscription_id: 'sub_abc' }),
    });
    const svc = new BillingService(repo as any, provider, mockEntitlements, mockSupabase);

    const result = await svc.createSubscription('user-1', 'company-1', 'price-1');

    expect(provider.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
      providerPlanId: 'plan_test123',
      notes: { company_id: 'company-1', user_id: 'user-1', local_subscription_id: 'local-sub-1' },
    }));
    expect(result.razorpay_subscription_id).toBe('sub_abc');
    expect(result.amount_minor).toBe(99900);
  });
});

describe('BillingService.verifyCheckout', () => {
  const localSub = {
    id: 'local-sub-1',
    company_id: 'company-1',
    provider_subscription_id: 'sub_abc',
    status: 'pending',
  };

  it('rejects when the subscription belongs to a different company (tenant isolation)', async () => {
    const repo = mockRepo({ getSubscriptionById: jest.fn().mockResolvedValue(localSub) });
    const svc = new BillingService(repo as any, mockProvider(), mockEntitlements, mockSupabase);

    await expect(svc.verifyCheckout('some-other-company', {
      localSubscriptionId: 'local-sub-1',
      razorpayPaymentId: 'pay_1',
      razorpaySubscriptionId: 'sub_abc',
      razorpaySignature: 'sig',
    })).rejects.toThrow(/not found/);
  });

  it('rejects when the browser-supplied subscription id does not match our stored one', async () => {
    const repo = mockRepo({ getSubscriptionById: jest.fn().mockResolvedValue(localSub) });
    const svc = new BillingService(repo as any, mockProvider(), mockEntitlements, mockSupabase);

    await expect(svc.verifyCheckout('company-1', {
      localSubscriptionId: 'local-sub-1',
      razorpayPaymentId: 'pay_1',
      razorpaySubscriptionId: 'sub_SPOOFED',
      razorpaySignature: 'sig',
    })).rejects.toThrow(/mismatch/);
  });

  it('rejects an invalid signature and does not mark the subscription authenticated', async () => {
    const repo = mockRepo({ getSubscriptionById: jest.fn().mockResolvedValue(localSub) });
    const provider = mockProvider({ verifyCheckoutSignature: jest.fn().mockReturnValue(false) });
    const svc = new BillingService(repo as any, provider, mockEntitlements, mockSupabase);

    await expect(svc.verifyCheckout('company-1', {
      localSubscriptionId: 'local-sub-1',
      razorpayPaymentId: 'pay_1',
      razorpaySubscriptionId: 'sub_abc',
      razorpaySignature: 'bad-sig',
    })).rejects.toThrow(/Signature verification failed/);
    expect(repo.updateSubscription).not.toHaveBeenCalled();
  });

  it('marks the subscription "authenticated" (not "active") on a valid signature — webhook remains the activation authority', async () => {
    const repo = mockRepo({ getSubscriptionById: jest.fn().mockResolvedValue(localSub) });
    const provider = mockProvider({ verifyCheckoutSignature: jest.fn().mockReturnValue(true) });
    const svc = new BillingService(repo as any, provider, mockEntitlements, mockSupabase);

    const result = await svc.verifyCheckout('company-1', {
      localSubscriptionId: 'local-sub-1',
      razorpayPaymentId: 'pay_1',
      razorpaySubscriptionId: 'sub_abc',
      razorpaySignature: 'good-sig',
    });

    expect(result).toEqual({ verified: true, status: 'authenticated' });
    expect(repo.updateSubscription).toHaveBeenCalledWith('local-sub-1', { status: 'authenticated' });
  });
});
