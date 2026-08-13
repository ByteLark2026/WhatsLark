import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
// razorpay's type declarations use `export = Razorpay` (CJS), so this must be
// imported with the TS `import X = require(...)` form — a plain default
// import silently breaks at runtime without esModuleInterop (not set in this
// project's tsconfig).
import Razorpay = require('razorpay');
import {
  CreateProviderSubscriptionParams,
  PaymentProvider,
  ProviderSubscription,
} from './payment-provider.interface';

/**
 * Razorpay implementation of PaymentProvider. Method names/shapes are
 * verified against the installed `razorpay` SDK (v2.9.8) source at
 * node_modules/razorpay/dist/resources/subscriptions.js — not guessed.
 *
 * Fails fast at boot if RAZORPAY_ENABLED=true but credentials are missing,
 * mirroring SupabaseService's eager-validation pattern.
 */
@Injectable()
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly logger = new Logger(RazorpayPaymentProvider.name);
  private readonly client: Razorpay | null = null;
  private readonly webhookSecret: string | undefined;
  readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.RAZORPAY_ENABLED === 'true';
    if (!this.enabled) {
      this.logger.warn('Razorpay billing is disabled (RAZORPAY_ENABLED != "true").');
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!keyId || !keySecret || !webhookSecret) {
      throw new Error(
        'RAZORPAY_ENABLED=true but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET are not all set.',
      );
    }

    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.webhookSecret = webhookSecret;
  }

  private requireClient(): Razorpay {
    if (!this.enabled || !this.client) {
      throw new BadRequestException('Billing is not enabled on this server.');
    }
    return this.client;
  }

  private mapStatus(sub: any): ProviderSubscription {
    return {
      providerSubscriptionId: sub.id,
      status: sub.status,
      currentStart: sub.current_start,
      currentEnd: sub.current_end,
      chargeAt: sub.charge_at,
      endedAt: sub.ended_at,
      shortUrl: sub.short_url,
    };
  }

  async createSubscription(params: CreateProviderSubscriptionParams): Promise<ProviderSubscription> {
    const client = this.requireClient();
    try {
      const sub = await client.subscriptions.create({
        plan_id: params.providerPlanId,
        total_count: params.totalCount,
        customer_notify: 1,
        notes: params.notes,
      });
      return this.mapStatus(sub);
    } catch (err: any) {
      throw new BadRequestException(`Razorpay subscription create failed: ${err?.error?.description || err.message}`);
    }
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const client = this.requireClient();
    try {
      const sub = await client.subscriptions.fetch(providerSubscriptionId);
      return this.mapStatus(sub);
    } catch (err: any) {
      throw new BadRequestException(`Razorpay subscription fetch failed: ${err?.error?.description || err.message}`);
    }
  }

  async cancelSubscription(providerSubscriptionId: string, cancelAtCycleEnd: boolean): Promise<ProviderSubscription> {
    const client = this.requireClient();
    try {
      // SDK signature: cancel(subscriptionId, cancelAtCycleEnd?: boolean) — positional, not an options object.
      const sub = await client.subscriptions.cancel(providerSubscriptionId, cancelAtCycleEnd);
      return this.mapStatus(sub);
    } catch (err: any) {
      throw new BadRequestException(`Razorpay subscription cancel failed: ${err?.error?.description || err.message}`);
    }
  }

  async pauseSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const client = this.requireClient();
    try {
      const sub = await client.subscriptions.pause(providerSubscriptionId, { pause_at: 'now' });
      return this.mapStatus(sub);
    } catch (err: any) {
      throw new BadRequestException(`Razorpay subscription pause failed: ${err?.error?.description || err.message}`);
    }
  }

  async resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const client = this.requireClient();
    try {
      const sub = await client.subscriptions.resume(providerSubscriptionId, { resume_at: 'now' });
      return this.mapStatus(sub);
    } catch (err: any) {
      throw new BadRequestException(`Razorpay subscription resume failed: ${err?.error?.description || err.message}`);
    }
  }

  async changeSubscriptionPlan(
    providerSubscriptionId: string,
    newProviderPlanId: string,
    scheduleChangeAtCycleEnd: boolean,
  ): Promise<ProviderSubscription> {
    const client = this.requireClient();
    try {
      // Razorpay's `update` supports `schedule_change_at`: 'now' | 'cycle_end'.
      const sub = await client.subscriptions.update(providerSubscriptionId, {
        plan_id: newProviderPlanId,
        schedule_change_at: scheduleChangeAtCycleEnd ? 'cycle_end' : 'now',
      });
      return this.mapStatus(sub);
    } catch (err: any) {
      throw new BadRequestException(`Razorpay plan change failed: ${err?.error?.description || err.message}`);
    }
  }

  /**
   * Razorpay Checkout (subscriptions) returns razorpay_payment_id,
   * razorpay_subscription_id, razorpay_signature. Expected signature is
   * HMAC-SHA256(payment_id + "|" + subscription_id, key_secret).
   * We recompute using the subscription_id loaded from OUR database, never
   * the value the browser sent, and compare with a timing-safe check.
   */
  verifyCheckoutSignature(params: { paymentId: string; subscriptionId: string; signature: string }): boolean {
    if (!this.enabled) return false;
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const expected = createHmac('sha256', secret)
      .update(`${params.paymentId}|${params.subscriptionId}`)
      .digest('hex');
    return timingSafeEqualHex(expected, params.signature);
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!this.enabled || !this.webhookSecret) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return timingSafeEqualHex(expected, signature);
  }
}

function timingSafeEqualHex(expectedHex: string, actualHex: string | undefined | null): boolean {
  if (!actualHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
