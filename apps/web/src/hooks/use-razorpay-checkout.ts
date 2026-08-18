import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { loadRazorpayCheckout } from '@/lib/razorpay';
import { useToast } from '@/hooks/use-toast';

export type CheckoutStatus = 'idle' | 'creating' | 'awaiting_payment' | 'verifying' | 'success' | 'error';

/**
 * Drives the full Razorpay Checkout flow for a billing_price_id:
 * create subscription -> open Checkout -> verify signature server-side.
 * The plan is never unlocked from browser state — `verify` only confirms
 * authenticity; the webhook remains the final authority on activation.
 */
export function useRazorpayCheckout(onVerified?: () => void) {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const startCheckout = useCallback(async (billingPriceId: string) => {
    if (inFlight.current) return; // prevent double-click duplicate subscription creation
    inFlight.current = true;
    setError(null);
    setStatus('creating');

    try {
      const created = await api.post<{
        local_subscription_id: string;
        razorpay_subscription_id: string;
        plan: { code: string; name: string };
        amount_minor: number;
        currency: string;
        razorpay_key_id: string | null;
      }>('/billing/subscriptions', { billing_price_id: billingPriceId });

      if (!created.razorpay_key_id) {
        throw new Error('Billing is not fully configured yet. Contact support.');
      }

      const Razorpay = await loadRazorpayCheckout();
      setStatus('awaiting_payment');

      const rzp = new Razorpay({
        key: created.razorpay_key_id,
        subscription_id: created.razorpay_subscription_id,
        name: 'LarkFlow',
        description: `${created.plan.name} subscription`,
        theme: { color: '#16a34a' },
        prefill: {
          name: user?.full_name || undefined,
          email: user?.email || undefined,
        },
        handler: async (response: any) => {
          setStatus('verifying');
          try {
            await api.post('/billing/subscriptions/verify', {
              local_subscription_id: created.local_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            setStatus('success');
            toast({ title: 'Payment verified', description: 'Activating your plan — this can take a few seconds.' });
            onVerified?.();
          } catch (err: any) {
            setStatus('error');
            setError(err.message || 'Verification failed');
            toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
          } finally {
            inFlight.current = false;
          }
        },
        modal: {
          ondismiss: () => {
            if (status !== 'success') {
              setStatus('idle');
            }
            inFlight.current = false;
          },
        },
      });

      rzp.on('payment.failed', (resp: any) => {
        setStatus('error');
        setError(resp?.error?.description || 'Payment failed');
        toast({ title: 'Payment failed', description: resp?.error?.description, variant: 'destructive' });
        inFlight.current = false;
      });

      rzp.open();
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Could not start checkout');
      toast({ title: 'Checkout error', description: err.message, variant: 'destructive' });
      inFlight.current = false;
    }
  }, [user, onVerified, toast, status]);

  return { status, error, startCheckout, isProcessing: status === 'creating' || status === 'awaiting_payment' || status === 'verifying' };
}
