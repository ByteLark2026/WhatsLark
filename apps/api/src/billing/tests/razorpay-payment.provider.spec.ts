import { createHmac } from 'crypto';
import { RazorpayPaymentProvider } from '../providers/razorpay-payment.provider';

describe('RazorpayPaymentProvider — signature verification', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      RAZORPAY_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_fake',
      RAZORPAY_KEY_SECRET: 'test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('throws at construction if enabled but credentials are missing (fail-safe startup)', () => {
    process.env.RAZORPAY_KEY_SECRET = '';
    expect(() => new RazorpayPaymentProvider()).toThrow(/RAZORPAY_ENABLED=true/);
  });

  it('does not throw when disabled, even with no credentials', () => {
    process.env.RAZORPAY_ENABLED = 'false';
    process.env.RAZORPAY_KEY_ID = '';
    process.env.RAZORPAY_KEY_SECRET = '';
    process.env.RAZORPAY_WEBHOOK_SECRET = '';
    expect(() => new RazorpayPaymentProvider()).not.toThrow();
  });

  describe('verifyCheckoutSignature', () => {
    it('accepts a correctly computed signature', () => {
      const provider = new RazorpayPaymentProvider();
      const paymentId = 'pay_test123';
      const subscriptionId = 'sub_test456';
      const signature = createHmac('sha256', 'test_key_secret')
        .update(`${paymentId}|${subscriptionId}`)
        .digest('hex');

      expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature })).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const provider = new RazorpayPaymentProvider();
      const result = provider.verifyCheckoutSignature({
        paymentId: 'pay_test123',
        subscriptionId: 'sub_test456',
        signature: 'deadbeef'.repeat(8),
      });
      expect(result).toBe(false);
    });

    it('rejects a signature computed with the wrong subscription id (prevents cross-subscription replay)', () => {
      const provider = new RazorpayPaymentProvider();
      const signatureForOtherSub = createHmac('sha256', 'test_key_secret')
        .update('pay_test123|sub_DIFFERENT')
        .digest('hex');

      expect(provider.verifyCheckoutSignature({
        paymentId: 'pay_test123',
        subscriptionId: 'sub_test456',
        signature: signatureForOtherSub,
      })).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('accepts a correctly computed webhook signature over the raw body', () => {
      const provider = new RazorpayPaymentProvider();
      const rawBody = Buffer.from(JSON.stringify({ event: 'subscription.activated' }));
      const signature = createHmac('sha256', 'test_webhook_secret').update(rawBody).digest('hex');

      expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it('rejects a signature that does not match the body (tampered payload)', () => {
      const provider = new RazorpayPaymentProvider();
      const rawBody = Buffer.from(JSON.stringify({ event: 'subscription.activated' }));
      const wrongSignature = createHmac('sha256', 'test_webhook_secret')
        .update(Buffer.from(JSON.stringify({ event: 'subscription.cancelled' })))
        .digest('hex');

      expect(provider.verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
    });

    it('rejects when no signature header is present', () => {
      const provider = new RazorpayPaymentProvider();
      const rawBody = Buffer.from('{}');
      expect(provider.verifyWebhookSignature(rawBody, '')).toBe(false);
    });
  });
});
