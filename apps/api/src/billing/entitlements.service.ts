import { Injectable, ForbiddenException } from '@nestjs/common';
import { BillingRepository } from './billing.repository';

export interface PlanFeatures {
  whatsapp_channels: number; // -1 = unlimited
  team_members: number;
  automations: number;
  contacts: number;
  ai_credits_monthly: number;
  api_access: boolean;
}

/**
 * Safe default when a company has no active subscription (never subscribed,
 * cancelled, or halted past grace). Deliberately minimal — missing billing
 * data must never accidentally grant paid-plan access.
 */
export const FREE_ENTITLEMENTS: PlanFeatures = {
  whatsapp_channels: 1,
  team_members: 1,
  automations: 0,
  contacts: 100,
  ai_credits_monthly: 0,
  api_access: false,
};

export class PlanLimitReachedError extends ForbiddenException {
  constructor(feature: string, current: number, limit: number) {
    super({
      code: 'PLAN_LIMIT_REACHED',
      feature,
      current,
      limit,
      upgradeRequired: true,
    });
  }
}

const UNLIMITED = -1;

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly repo: BillingRepository) {}

  /**
   * Access is granted for 'active' subscriptions and for 'pending_payment'
   * (grace period — see BILLING_GRACE_PERIOD_DAYS policy in the webhook
   * handler). Every other status (halted/paused/cancelled/completed/pending/
   * authenticated/none) falls back to FREE_ENTITLEMENTS.
   */
  async getCompanyEntitlements(companyId: string): Promise<PlanFeatures> {
    const sub = await this.repo.getActiveSubscriptionForCompany(companyId);
    if (!sub) return FREE_ENTITLEMENTS;
    if (sub.status !== 'active' && sub.status !== 'pending_payment') return FREE_ENTITLEMENTS;

    const features = sub.billing_prices?.billing_plans?.features;
    if (!features) return FREE_ENTITLEMENTS;
    return { ...FREE_ENTITLEMENTS, ...features };
  }

  private check(feature: string, current: number, limit: number) {
    if (limit === UNLIMITED) return;
    if (current >= limit) throw new PlanLimitReachedError(feature, current, limit);
  }

  async canCreateChannel(companyId: string): Promise<void> {
    const ent = await this.getCompanyEntitlements(companyId);
    const current = await this.repo.countActiveChannels(companyId);
    this.check('whatsapp_channels', current, ent.whatsapp_channels);
  }

  async canInviteTeamMember(companyId: string): Promise<void> {
    const ent = await this.getCompanyEntitlements(companyId);
    const current = await this.repo.countActiveTeamMembers(companyId);
    this.check('team_members', current, ent.team_members);
  }

  async canCreateAutomation(companyId: string): Promise<void> {
    const ent = await this.getCompanyEntitlements(companyId);
    const current = await this.repo.countActiveAutomations(companyId);
    this.check('automations', current, ent.automations);
  }

  async canCreateContact(companyId: string): Promise<void> {
    const ent = await this.getCompanyEntitlements(companyId);
    const current = await this.repo.countContacts(companyId);
    this.check('contacts', current, ent.contacts);
  }

  async canUseApi(companyId: string): Promise<void> {
    const ent = await this.getCompanyEntitlements(companyId);
    if (!ent.api_access) {
      throw new PlanLimitReachedError('api_access', 0, 0);
    }
  }

  /** Consumes AI credits against the current calendar-month counter; throws if it would exceed the plan's monthly allowance. */
  async consumeAiCredits(companyId: string, quantity = 1): Promise<void> {
    const ent = await this.getCompanyEntitlements(companyId);
    const { start, end } = currentMonthWindow();

    if (ent.ai_credits_monthly !== UNLIMITED) {
      const counter = await this.repo.getUsageCounter(companyId, 'ai_credits', start);
      const used = counter?.used_quantity || 0;
      if (used + quantity > ent.ai_credits_monthly) {
        throw new PlanLimitReachedError('ai_credits_monthly', used, ent.ai_credits_monthly);
      }
    }

    await this.repo.incrementUsageCounter(companyId, 'ai_credits', start, end, quantity);
  }

  async getUsageSummary(companyId: string) {
    const ent = await this.getCompanyEntitlements(companyId);
    const { start } = currentMonthWindow();
    const [channels, teamMembers, automations, contacts, aiCounter] = await Promise.all([
      this.repo.countActiveChannels(companyId),
      this.repo.countActiveTeamMembers(companyId),
      this.repo.countActiveAutomations(companyId),
      this.repo.countContacts(companyId),
      this.repo.getUsageCounter(companyId, 'ai_credits', start),
    ]);

    return {
      whatsapp_channels: { used: channels, limit: ent.whatsapp_channels },
      team_members: { used: teamMembers, limit: ent.team_members },
      automations: { used: automations, limit: ent.automations },
      contacts: { used: contacts, limit: ent.contacts },
      ai_credits_monthly: { used: aiCounter?.used_quantity || 0, limit: ent.ai_credits_monthly },
      api_access: ent.api_access,
    };
  }
}
