import { Inject, Injectable, Logger } from '@nestjs/common';
import { BillingRepository } from '../billing.repository';
import { PAYMENT_PROVIDER, PaymentProvider } from '../providers/payment-provider.interface';
import { mapProviderStatus } from '../billing.service';

const GRACE_DAYS = parseInt(process.env.BILLING_GRACE_PERIOD_DAYS || '3', 10);

// Events that change subscription state significantly enough that we re-fetch
// the canonical subscription from Razorpay rather than trusting the webhook
// payload alone — protects against out-of-order delivery.
const RECONCILE_ON_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.updated',
]);

@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    private readonly repo: BillingRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Processes one verified webhook event. Caller (controller) is responsible
   * for signature verification and idempotency recording before invoking this.
   */
  async handleEvent(eventType: string, body: any) {
    const subEntity = body?.payload?.subscription?.entity;
    const paymentEntity = body?.payload?.payment?.entity;

    if (!subEntity?.id) {
      this.logger.warn(`Webhook ${eventType} had no subscription entity — skipping.`);
      return;
    }

    let local = await this.repo.getSubscriptionByProviderId(subEntity.id);
    if (!local) {
      this.logger.warn(`Webhook ${eventType} for unknown subscription ${subEntity.id} — skipping.`);
      return;
    }

    // For state-changing events, fetch canonical state from Razorpay instead
    // of trusting this specific payload — handles out-of-order delivery.
    const canonical = RECONCILE_ON_EVENTS.has(eventType)
      ? await this.provider.fetchSubscription(subEntity.id)
      : null;

    const source = canonical || {
      status: subEntity.status,
      currentStart: subEntity.current_start,
      currentEnd: subEntity.current_end,
      chargeAt: subEntity.charge_at,
      endedAt: subEntity.ended_at,
    };

    switch (eventType) {
      case 'subscription.authenticated':
        await this.repo.updateSubscription(local.id, { status: 'authenticated' });
        break;

      case 'subscription.activated':
        await this.repo.updateSubscription(local.id, {
          status: 'active',
          current_period_start: toIso(source.currentStart),
          current_period_end: toIso(source.currentEnd),
          next_charge_at: toIso(source.chargeAt),
          grace_ends_at: null,
        });
        break;

      case 'subscription.charged': {
        if (paymentEntity?.id) {
          await this.repo.upsertPaymentByProviderId({
            provider_payment_id: paymentEntity.id,
            company_id: local.company_id,
            billing_subscription_id: local.id,
            provider_invoice_id: body?.payload?.invoice?.entity?.id || null,
            amount_minor: paymentEntity.amount,
            currency: paymentEntity.currency || 'INR',
            status: paymentEntity.status === 'captured' ? 'captured' : 'failed',
            payment_method: paymentEntity.method || null,
            paid_at: paymentEntity.created_at ? toIso(paymentEntity.created_at) : null,
          });
        }

        // New billing period started — reset periodic usage counters.
        const periodChanged = local.current_period_start !== toIso(source.currentStart);

        await this.repo.updateSubscription(local.id, {
          status: 'active',
          current_period_start: toIso(source.currentStart),
          current_period_end: toIso(source.currentEnd),
          next_charge_at: toIso(source.chargeAt),
          grace_ends_at: null,
        });

        if (periodChanged) {
          // Usage counters are keyed by calendar month, not billing cycle, and
          // reset naturally each month — nothing to do here beyond confirming
          // the subscription is in good standing again after a charge.
          this.logger.log(`Subscription ${local.id} entered a new billing period.`);
        }
        break;
      }

      case 'subscription.updated':
        await this.repo.updateSubscription(local.id, {
          status: mapProviderStatus(source.status),
          current_period_start: toIso(source.currentStart),
          current_period_end: toIso(source.currentEnd),
          next_charge_at: toIso(source.chargeAt),
        });
        break;

      case 'subscription.pending': {
        const graceEndsAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        await this.repo.updateSubscription(local.id, {
          status: 'pending_payment',
          grace_ends_at: graceEndsAt,
        });
        break;
      }

      case 'subscription.halted':
        await this.repo.updateSubscription(local.id, { status: 'halted' });
        break;

      case 'subscription.paused':
        await this.repo.updateSubscription(local.id, { status: 'paused' });
        break;

      case 'subscription.resumed':
        await this.repo.updateSubscription(local.id, {
          status: 'active',
          current_period_start: toIso(source.currentStart),
          current_period_end: toIso(source.currentEnd),
          next_charge_at: toIso(source.chargeAt),
        });
        break;

      case 'subscription.cancelled':
        await this.repo.updateSubscription(local.id, {
          status: 'cancelled',
          ended_at: source.endedAt ? toIso(source.endedAt) : new Date().toISOString(),
        });
        break;

      case 'subscription.completed':
        await this.repo.updateSubscription(local.id, {
          status: 'completed',
          ended_at: new Date().toISOString(),
        });
        break;

      default:
        this.logger.log(`Unhandled billing webhook event type: ${eventType}`);
    }
  }
}

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}
