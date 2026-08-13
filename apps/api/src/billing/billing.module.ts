import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRepository } from './billing.repository';
import { EntitlementsService } from './entitlements.service';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { RazorpayWebhookController } from './webhooks/razorpay-webhook.controller';
import { RazorpayWebhookService } from './webhooks/razorpay-webhook.service';

@Module({
  controllers: [BillingController, RazorpayWebhookController],
  providers: [
    BillingService,
    BillingRepository,
    EntitlementsService,
    RazorpayWebhookService,
    { provide: PAYMENT_PROVIDER, useClass: RazorpayPaymentProvider },
  ],
  exports: [EntitlementsService, BillingService],
})
export class BillingModule {}
