import { RazorpayWebhookService } from '../webhooks/razorpay-webhook.service';
import { BillingRepository } from '../billing.repository';
import { PaymentProvider } from '../providers/payment-provider.interface';

function mockRepo(overrides: Record<string, any> = {}) {
  return {
    getSubscriptionByProviderId: jest.fn(),
    updateSubscription: jest.fn().mockResolvedValue({}),
    upsertPaymentByProviderId: jest.fn().mockResolvedValue({}),
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

const LOCAL_SUB = { id: 'local-sub-1', company_id: 'company-1', current_period_start: null };

describe('RazorpayWebhookService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { process.env = { ...OLD_ENV, BILLING_GRACE_PERIOD_DAYS: '3' }; });
  afterEach(() => { process.env = OLD_ENV; });

  it('skips silently when the subscription is unknown locally (no crash on unrelated webhook)', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(null) });
    const provider = mockProvider();
    const svc = new RazorpayWebhookService(repo as any, provider);

    await svc.handleEvent('subscription.activated', {
      payload: { subscription: { entity: { id: 'sub_unknown', status: 'active' } } },
    });

    expect(repo.updateSubscription).not.toHaveBeenCalled();
  });

  it('subscription.activated fetches canonical state and marks the subscription active with period dates', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(LOCAL_SUB) });
    const provider = mockProvider({
      fetchSubscription: jest.fn().mockResolvedValue({
        providerSubscriptionId: 'sub_abc', status: 'active',
        currentStart: 1700000000, currentEnd: 1702592000, chargeAt: 1702592000,
      }),
    });
    const svc = new RazorpayWebhookService(repo as any, provider);

    await svc.handleEvent('subscription.activated', {
      payload: { subscription: { entity: { id: 'sub_abc', status: 'active' } } },
    });

    // Out-of-order protection: canonical state is fetched, not just trusted from the payload.
    expect(provider.fetchSubscription).toHaveBeenCalledWith('sub_abc');
    expect(repo.updateSubscription).toHaveBeenCalledWith('local-sub-1', expect.objectContaining({ status: 'active' }));
  });

  it('subscription.charged upserts the payment by provider_payment_id and refreshes subscription dates', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(LOCAL_SUB) });
    const provider = mockProvider({
      fetchSubscription: jest.fn().mockResolvedValue({
        providerSubscriptionId: 'sub_abc', status: 'active',
        currentStart: 1700000000, currentEnd: 1702592000, chargeAt: 1702592000,
      }),
    });
    const svc = new RazorpayWebhookService(repo as any, provider);

    await svc.handleEvent('subscription.charged', {
      payload: {
        subscription: { entity: { id: 'sub_abc', status: 'active' } },
        payment: { entity: { id: 'pay_xyz', amount: 99900, currency: 'INR', status: 'captured', method: 'card', created_at: 1700000100 } },
      },
    });

    expect(repo.upsertPaymentByProviderId).toHaveBeenCalledWith(expect.objectContaining({
      provider_payment_id: 'pay_xyz',
      amount_minor: 99900, // integer, paise — never a float
      status: 'captured',
    }));
    expect(repo.updateSubscription).toHaveBeenCalledWith('local-sub-1', expect.objectContaining({ status: 'active' }));
  });

  it('subscription.pending sets grace_ends_at using BILLING_GRACE_PERIOD_DAYS', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(LOCAL_SUB) });
    const svc = new RazorpayWebhookService(repo as any, mockProvider());

    const before = Date.now();
    await svc.handleEvent('subscription.pending', {
      payload: { subscription: { entity: { id: 'sub_abc', status: 'pending' } } },
    });
    const after = Date.now();

    const call = repo.updateSubscription.mock.calls[0][1];
    expect(call.status).toBe('pending_payment');
    const graceMs = new Date(call.grace_ends_at).getTime();
    expect(graceMs).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000 - 1000);
    expect(graceMs).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('subscription.halted marks the subscription halted without touching unrelated tables (data preserved)', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(LOCAL_SUB) });
    const provider = mockProvider({ fetchSubscription: jest.fn().mockResolvedValue({ providerSubscriptionId: 'sub_abc', status: 'halted' }) });
    const svc = new RazorpayWebhookService(repo as any, provider);

    await svc.handleEvent('subscription.halted', {
      payload: { subscription: { entity: { id: 'sub_abc', status: 'halted' } } },
    });

    expect(repo.updateSubscription).toHaveBeenCalledWith('local-sub-1', { status: 'halted' });
  });

  it('subscription.cancelled sets status cancelled and an ended_at timestamp, nothing else', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(LOCAL_SUB) });
    const provider = mockProvider({ fetchSubscription: jest.fn().mockResolvedValue({ providerSubscriptionId: 'sub_abc', status: 'cancelled' }) });
    const svc = new RazorpayWebhookService(repo as any, provider);

    await svc.handleEvent('subscription.cancelled', {
      payload: { subscription: { entity: { id: 'sub_abc', status: 'cancelled' } } },
    });

    const call = repo.updateSubscription.mock.calls[0][1];
    expect(call.status).toBe('cancelled');
    expect(call.ended_at).toBeDefined();
  });

  it('ignores unknown event types without throwing', async () => {
    const repo = mockRepo({ getSubscriptionByProviderId: jest.fn().mockResolvedValue(LOCAL_SUB) });
    const svc = new RazorpayWebhookService(repo as any, mockProvider());

    await expect(svc.handleEvent('subscription.some_future_event', {
      payload: { subscription: { entity: { id: 'sub_abc', status: 'active' } } },
    })).resolves.toBeUndefined();
    expect(repo.updateSubscription).not.toHaveBeenCalled();
  });
});
