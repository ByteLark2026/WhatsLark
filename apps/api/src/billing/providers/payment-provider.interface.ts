/**
 * Provider-agnostic billing abstraction. Only Razorpay is implemented today,
 * but the billing domain (BillingService, EntitlementsService, webhook
 * processing) is written against this interface so a second provider
 * (Stripe, a UAE gateway, ...) can be added later without touching it.
 */

export interface CreateProviderSubscriptionParams {
  /** Provider-side plan identifier (e.g. Razorpay plan_xxx). */
  providerPlanId: string;
  /** Number of billing cycles; provider-specific meaning of "until cancelled". */
  totalCount: number;
  /** Safe, non-sensitive metadata attached at the provider for support/audit. */
  notes: Record<string, string>;
}

export interface ProviderSubscription {
  providerSubscriptionId: string;
  status: string;
  currentStart?: number; // unix seconds
  currentEnd?: number;
  chargeAt?: number;
  endedAt?: number;
  shortUrl?: string;
}

export interface PaymentProvider {
  readonly name: string;

  createSubscription(params: CreateProviderSubscriptionParams): Promise<ProviderSubscription>;

  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  /** cancelAtCycleEnd=true schedules cancellation for the end of the current billing cycle. */
  cancelSubscription(providerSubscriptionId: string, cancelAtCycleEnd: boolean): Promise<ProviderSubscription>;

  pauseSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  /** Schedules a plan change; provider decides immediate vs cycle-end based on `scheduleChangeAtCycleEnd`. */
  changeSubscriptionPlan(
    providerSubscriptionId: string,
    newProviderPlanId: string,
    scheduleChangeAtCycleEnd: boolean,
  ): Promise<ProviderSubscription>;

  /** Verifies a Razorpay Checkout success callback (payment_id + subscription_id + signature). Timing-safe. */
  verifyCheckoutSignature(params: { paymentId: string; subscriptionId: string; signature: string }): boolean;

  /** Verifies an inbound webhook's HMAC signature against the raw request body. Timing-safe. */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
