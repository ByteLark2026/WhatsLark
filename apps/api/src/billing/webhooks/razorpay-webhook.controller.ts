import { Controller, Post, Req, Res, Headers, HttpStatus, Logger, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PAYMENT_PROVIDER, PaymentProvider } from '../providers/payment-provider.interface';
import { BillingRepository } from '../billing.repository';
import { RazorpayWebhookService } from './razorpay-webhook.service';

/**
 * Publicly reachable (no JwtAuthGuard — Razorpay is a server, not a logged-in
 * user) but cryptographically verified via HMAC-SHA256 over the raw body.
 * `main.ts` already enables `rawBody: true` app-wide, so `req.rawBody` is the
 * exact bytes Razorpay sent, untouched by JSON parsing — required for the
 * signature check to match.
 */
@SkipThrottle()
@Controller('billing/webhooks')
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly repo: BillingRepository,
    private readonly webhookService: RazorpayWebhookService,
  ) {}

  @Post('razorpay')
  async handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('Webhook received with no raw body captured — check rawBody config.');
      return res.status(HttpStatus.BAD_REQUEST).json({ ok: false });
    }

    const validSignature = this.provider.verifyWebhookSignature(rawBody, signature || '');
    if (!validSignature) {
      this.logger.warn('Rejected webhook with invalid signature.');
      return res.status(HttpStatus.UNAUTHORIZED).json({ ok: false });
    }

    const body = req.body as any;
    const eventType: string = body?.event;
    // Razorpay always sends x-razorpay-event-id on modern accounts; fall back to
    // a payload-derived key so idempotency still holds if it's ever absent.
    const idempotencyKey = eventId || `${eventType}:${body?.payload?.subscription?.entity?.id}:${body?.created_at}`;

    if (!eventType || !idempotencyKey) {
      return res.status(HttpStatus.BAD_REQUEST).json({ ok: false });
    }

    const isNew = await this.repo.recordWebhookEventIfNew({
      provider: 'razorpay',
      provider_event_id: idempotencyKey,
      event_type: eventType,
      provider_created_at: body?.created_at ? new Date(body.created_at * 1000).toISOString() : null,
    });

    if (!isNew) {
      // Duplicate delivery — already processed (or in flight). Ack without reprocessing.
      return res.status(HttpStatus.OK).json({ ok: true, duplicate: true });
    }

    try {
      await this.webhookService.handleEvent(eventType, body);
      await this.repo.markWebhookEventProcessed(idempotencyKey);
      return res.status(HttpStatus.OK).json({ ok: true });
    } catch (err: any) {
      // Log without secrets/full payload — just the event type and error.
      this.logger.error(`Failed processing ${eventType}: ${err.message}`);
      await this.repo.markWebhookEventFailed(idempotencyKey, err.message);
      // Still return 2xx: Razorpay will retry on non-2xx, but a processing bug
      // on our side retrying forever isn't useful — reconciliation endpoint
      // exists to repair state. Signature/parsing failures above already 4xx'd.
      return res.status(HttpStatus.OK).json({ ok: false, error: 'processing_failed' });
    }
  }
}
