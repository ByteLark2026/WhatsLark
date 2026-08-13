import { EntitlementsService, FREE_ENTITLEMENTS, PlanLimitReachedError } from '../entitlements.service';
import { BillingRepository } from '../billing.repository';

function mockRepo(overrides: Partial<jest.Mocked<BillingRepository>> = {}) {
  return {
    getActiveSubscriptionForCompany: jest.fn(),
    countActiveChannels: jest.fn().mockResolvedValue(0),
    countActiveTeamMembers: jest.fn().mockResolvedValue(0),
    countActiveAutomations: jest.fn().mockResolvedValue(0),
    countContacts: jest.fn().mockResolvedValue(0),
    getUsageCounter: jest.fn().mockResolvedValue(null),
    incrementUsageCounter: jest.fn().mockResolvedValue({ used_quantity: 1 }),
    ...overrides,
  } as unknown as jest.Mocked<BillingRepository>;
}

const PROFESSIONAL_FEATURES = {
  whatsapp_channels: 3,
  team_members: 10,
  automations: 25,
  contacts: 10000,
  ai_credits_monthly: 2000,
  api_access: true,
};

describe('EntitlementsService', () => {
  it('falls back to FREE_ENTITLEMENTS when the company has no subscription (never grants paid access by accident)', async () => {
    const repo = mockRepo({ getActiveSubscriptionForCompany: jest.fn().mockResolvedValue(null) });
    const svc = new EntitlementsService(repo);
    const ent = await svc.getCompanyEntitlements('company-1');
    expect(ent).toEqual(FREE_ENTITLEMENTS);
  });

  it('falls back to FREE_ENTITLEMENTS for a halted/cancelled subscription', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'halted',
        billing_prices: { billing_plans: { features: PROFESSIONAL_FEATURES } },
      }),
    });
    const svc = new EntitlementsService(repo);
    const ent = await svc.getCompanyEntitlements('company-1');
    expect(ent).toEqual(FREE_ENTITLEMENTS);
  });

  it('grants plan entitlements for an active subscription', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'active',
        billing_prices: { billing_plans: { features: PROFESSIONAL_FEATURES } },
      }),
    });
    const svc = new EntitlementsService(repo);
    const ent = await svc.getCompanyEntitlements('company-1');
    expect(ent.whatsapp_channels).toBe(3);
    expect(ent.api_access).toBe(true);
  });

  it('grants plan entitlements during the pending_payment grace period', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'pending_payment',
        billing_prices: { billing_plans: { features: PROFESSIONAL_FEATURES } },
      }),
    });
    const svc = new EntitlementsService(repo);
    const ent = await svc.getCompanyEntitlements('company-1');
    expect(ent.whatsapp_channels).toBe(3);
  });

  it('canCreateChannel throws PLAN_LIMIT_REACHED with structured fields once at the limit', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue(null), // free plan: 1 channel
      countActiveChannels: jest.fn().mockResolvedValue(1),
    });
    const svc = new EntitlementsService(repo);

    await expect(svc.canCreateChannel('company-1')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', feature: 'whatsapp_channels', current: 1, limit: 1, upgradeRequired: true },
    });
  });

  it('canCreateChannel allows creation when under the limit', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'active',
        billing_prices: { billing_plans: { features: PROFESSIONAL_FEATURES } },
      }),
      countActiveChannels: jest.fn().mockResolvedValue(2),
    });
    const svc = new EntitlementsService(repo);
    await expect(svc.canCreateChannel('company-1')).resolves.toBeUndefined();
  });

  it('treats -1 as unlimited and never throws regardless of current usage', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'active',
        billing_prices: { billing_plans: { features: { ...PROFESSIONAL_FEATURES, whatsapp_channels: -1 } } },
      }),
      countActiveChannels: jest.fn().mockResolvedValue(999),
    });
    const svc = new EntitlementsService(repo);
    await expect(svc.canCreateChannel('company-1')).resolves.toBeUndefined();
  });

  it('consumeAiCredits throws once the monthly allowance would be exceeded, without incrementing further', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'active',
        billing_prices: { billing_plans: { features: { ...PROFESSIONAL_FEATURES, ai_credits_monthly: 5 } } },
      }),
      getUsageCounter: jest.fn().mockResolvedValue({ used_quantity: 5 }),
    });
    const svc = new EntitlementsService(repo);

    await expect(svc.consumeAiCredits('company-1', 1)).rejects.toBeInstanceOf(PlanLimitReachedError);
    expect(repo.incrementUsageCounter).not.toHaveBeenCalled();
  });

  it('consumeAiCredits increments the usage counter when under the allowance', async () => {
    const repo = mockRepo({
      getActiveSubscriptionForCompany: jest.fn().mockResolvedValue({
        status: 'active',
        billing_prices: { billing_plans: { features: { ...PROFESSIONAL_FEATURES, ai_credits_monthly: 5 } } },
      }),
      getUsageCounter: jest.fn().mockResolvedValue({ used_quantity: 2 }),
    });
    const svc = new EntitlementsService(repo);

    await svc.consumeAiCredits('company-1', 1);
    expect(repo.incrementUsageCounter).toHaveBeenCalledWith('company-1', 'ai_credits', expect.any(String), expect.any(String), 1);
  });
});
