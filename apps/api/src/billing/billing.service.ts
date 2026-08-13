import { Inject, Injectable, BadRequestException, Logger } from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { PAYMENT_PROVIDER, PaymentProvider } from './providers/payment-provider.interface';
import { EntitlementsService } from './entitlements.service';
import { SupabaseService } from '../common/supabase.service';

// "Until cancelled" isn't a real option on Razorpay subscriptions — total_count
// is required, so we use a long-running cycle count instead (renews well past
// any realistic customer lifetime; changing/cancelling is unaffected by this).
const TOTAL_COUNT_BY_INTERVAL: Record<string, number> = {
  monthly: 120, // 10 years of monthly cycles
  yearly: 15,   // 15 years of yearly cycles
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly repo: BillingRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly entitlements: EntitlementsService,
    private readonly supabase: SupabaseService,
  ) {}

  async getPublicPlans() {
    const plans = await this.repo.listActivePlans();
    if (!plans.length) return [];
    const prices = await this.repo.listActivePricesForPlans(plans.map((p) => p.id));

    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      prices: prices
        .filter((pr) => pr.plan_id === plan.id)
        .map((pr) => ({
          id: pr.id,
          billing_interval: pr.billing_interval,
          currency: pr.currency,
          amount_minor: pr.amount_minor,
        })),
    }));
  }

  async getCompanySubscription(companyId: string) {
    const sub = await this.repo.getActiveSubscriptionForCompany(companyId);
    const entitlements = await this.entitlements.getCompanyEntitlements(companyId);
    if (!sub) return { subscription: null, entitlements };

    return {
      subscription: {
        id: sub.id,
        status: sub.status,
        plan_code: sub.billing_prices?.billing_plans?.code,
        plan_name: sub.billing_prices?.billing_plans?.name,
        billing_interval: sub.billing_prices?.billing_interval,
        currency: sub.billing_prices?.currency,
        amount_minor: sub.billing_prices?.amount_minor,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        next_charge_at: sub.next_charge_at,
        grace_ends_at: sub.grace_ends_at,
        cancel_at_period_end: sub.cancel_at_period_end,
        cancelled_at: sub.cancelled_at,
      },
      entitlements,
    };
  }

  async getCompanyPayments(companyId: string, page = 1, limit = 20) {
    return this.repo.listPaymentsForCompany(companyId, page, limit);
  }

  async createSubscription(userId: string, companyId: string, billingPriceId: string) {
    const existing = await this.repo.getActiveSubscriptionForCompany(companyId);
    if (existing) {
      throw new BadRequestException('This company already has an active or pending subscription. Cancel it before starting a new one.');
    }

    const price = await this.repo.getActivePriceById(billingPriceId);
    const totalCount = TOTAL_COUNT_BY_INTERVAL[price.billing_interval] || 120;

    // Store the pending row first so we have a local id to embed in provider notes
    // and to use as the source of truth when verifying the Checkout callback.
    const local = await this.repo.createPendingSubscription({
      company_id: companyId,
      billing_price_id: price.id,
      provider: price.provider,
      created_by_user_id: userId,
    });

    const providerSub = await this.provider.createSubscription({
      providerPlanId: price.provider_plan_id,
      totalCount,
      notes: {
        company_id: companyId,
        user_id: userId,
        local_subscription_id: local.id,
      },
    });

    const updated = await this.repo.attachProviderSubscriptionId(local.id, providerSub.providerSubscriptionId);

    return {
      local_subscription_id: updated.id,
      razorpay_subscription_id: providerSub.providerSubscriptionId,
      plan: { code: price.billing_plans.code, name: price.billing_plans.name },
      amount_minor: price.amount_minor,
      currency: price.currency,
    };
  }

  /**
   * Verifies the Checkout success callback server-side. This confirms
   * authenticity of the browser round-trip only — it does NOT itself
   * activate paid access. Activation happens from the `subscription.*`
   * webhooks, which are the final authority (see razorpay-webhook.service.ts).
   */
  async verifyCheckout(companyId: string, params: {
    localSubscriptionId: string;
    razorpayPaymentId: string;
    razorpaySubscriptionId: string;
    razorpaySignature: string;
  }) {
    const local = await this.repo.getSubscriptionById(params.localSubscriptionId);
    if (!local) throw new BadRequestException('Subscription not found');
    // Tenant isolation: the subscription must belong to the caller's own company.
    if (local.company_id !== companyId) throw new BadRequestException('Subscription not found');
    if (!local.provider_subscription_id) {
      throw new BadRequestException('Subscription was never created at the provider');
    }
    // Never trust the browser's subscription id — compare against our stored one.
    if (local.provider_subscription_id !== params.razorpaySubscriptionId) {
      throw new BadRequestException('Subscription id mismatch');
    }

    const valid = this.provider.verifyCheckoutSignature({
      paymentId: params.razorpayPaymentId,
      subscriptionId: local.provider_subscription_id,
      signature: params.razorpaySignature,
    });

    if (!valid) {
      this.logger.warn(`Checkout signature verification failed for subscription ${local.id}`);
      throw new BadRequestException('Signature verification failed');
    }

    // Mark authenticated locally; webhook remains authoritative for 'active'.
    if (local.status === 'pending') {
      await this.repo.updateSubscription(local.id, { status: 'authenticated' });
    }

    return { verified: true, status: 'authenticated' };
  }

  async changePlan(companyId: string, billingPriceId: string, atCycleEnd: boolean) {
    const sub = await this.repo.getActiveSubscriptionForCompany(companyId);
    if (!sub || !sub.provider_subscription_id) {
      throw new BadRequestException('No active subscription to change');
    }
    const newPrice = await this.repo.getActivePriceById(billingPriceId);

    const providerSub = await this.provider.changeSubscriptionPlan(
      sub.provider_subscription_id,
      newPrice.provider_plan_id,
      atCycleEnd,
    );

    // Local billing_price_id flips immediately only for "now" changes; for
    // cycle-end changes the webhook (subscription.updated / .charged on the
    // next cycle) is what actually confirms the new plan is in effect.
    if (!atCycleEnd) {
      await this.repo.updateSubscription(sub.id, { billing_price_id: newPrice.id });
    }

    return { status: providerSub.status, scheduled_for: atCycleEnd ? 'cycle_end' : 'now' };
  }

  async cancelSubscription(companyId: string) {
    const sub = await this.repo.getActiveSubscriptionForCompany(companyId);
    if (!sub || !sub.provider_subscription_id) {
      throw new BadRequestException('No active subscription to cancel');
    }

    // Always cancel at cycle end — never delete data or cut access mid-cycle
    // from this endpoint; the webhook confirms the final state transition.
    const providerSub = await this.provider.cancelSubscription(sub.provider_subscription_id, true);

    const updated = await this.repo.updateSubscription(sub.id, {
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    });

    return { status: providerSub.status, cancel_at_period_end: updated.cancel_at_period_end };
  }

  async resumeSubscription(companyId: string) {
    const sub = await this.repo.getActiveSubscriptionForCompany(companyId);
    if (!sub || !sub.provider_subscription_id) {
      throw new BadRequestException('No subscription to resume');
    }
    if (sub.status !== 'paused') {
      throw new BadRequestException(`Cannot resume a subscription in status "${sub.status}"`);
    }

    const providerSub = await this.provider.resumeSubscription(sub.provider_subscription_id);
    return { status: providerSub.status };
  }

  /**
   * Admin-safe reconciliation: fetches the canonical subscription state from
   * Razorpay and repairs the local row if a webhook was missed or arrived
   * out of order. Does not trust local state as ground truth.
   */
  async reconcileSubscription(localSubscriptionId: string) {
    const local = await this.repo.getSubscriptionById(localSubscriptionId);
    if (!local || !local.provider_subscription_id) {
      throw new BadRequestException('Subscription not found or never created at provider');
    }

    const canonical = await this.provider.fetchSubscription(local.provider_subscription_id);

    const patch: Record<string, any> = { status: mapProviderStatus(canonical.status) };
    if (canonical.currentStart) patch.current_period_start = new Date(canonical.currentStart * 1000).toISOString();
    if (canonical.currentEnd) patch.current_period_end = new Date(canonical.currentEnd * 1000).toISOString();
    if (canonical.chargeAt) patch.next_charge_at = new Date(canonical.chargeAt * 1000).toISOString();
    if (canonical.endedAt) patch.ended_at = new Date(canonical.endedAt * 1000).toISOString();

    return this.repo.updateSubscription(local.id, patch);
  }

  /** Convenience for prefilling Razorpay Checkout with the authenticated user's details. */
  async getUserProfile(userId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();
    return data;
  }
}

/** Maps Razorpay's subscription status strings to our local enum. */
export function mapProviderStatus(razorpayStatus: string): string {
  switch (razorpayStatus) {
    case 'created': return 'pending';
    case 'authenticated': return 'authenticated';
    case 'active': return 'active';
    case 'pending': return 'pending_payment';
    case 'halted': return 'halted';
    case 'paused': return 'paused';
    case 'cancelled': return 'cancelled';
    case 'completed': return 'completed';
    case 'expired': return 'cancelled';
    default: return razorpayStatus;
  }
}
