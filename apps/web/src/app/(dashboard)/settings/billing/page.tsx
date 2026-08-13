'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2, CreditCard, ArrowUpRight, XCircle, PlayCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/razorpay';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionView {
  id: string;
  status: string;
  plan_code: string;
  plan_name: string;
  billing_interval: string;
  currency: string;
  amount_minor: number;
  current_period_start: string | null;
  current_period_end: string | null;
  next_charge_at: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}

interface Entitlements {
  whatsapp_channels: number;
  team_members: number;
  automations: number;
  contacts: number;
  ai_credits_monthly: number;
  api_access: boolean;
}

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'secondary' | 'destructive' | 'warning' }> = {
  active: { label: 'Active', variant: 'success' },
  authenticated: { label: 'Authenticated (awaiting activation)', variant: 'secondary' },
  pending: { label: 'Pending', variant: 'secondary' },
  pending_payment: { label: 'Payment issue — grace period', variant: 'warning' },
  halted: { label: 'Halted — payment failed', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'secondary' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BillingSettingsPage() {
  const { toast } = useToast();
  const { role } = useAuthStore();
  const searchParams = useSearchParams();
  const isOwnerAdmin = role === 'owner' || role === 'admin';

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ subscription: SubscriptionView | null; entitlements: Entitlements }>('/billing/subscription');
      setSubscription(res.subscription);
      setEntitlements(res.entitlements);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('activated') === '1') {
      toast({ title: 'Payment verification in progress', description: 'Your plan will activate automatically once confirmed — this page will update shortly.' });
      // Webhook-driven activation can lag a few seconds behind the redirect — poll briefly.
      const interval = setInterval(load, 4000);
      const timeout = setTimeout(() => clearInterval(interval), 30000);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
  }, [searchParams, load, toast]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post('/billing/subscriptions/cancel', { confirm: true });
      toast({ title: 'Cancellation scheduled', description: 'Your plan stays active until the end of the current billing period.' });
      setShowCancelConfirm(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Could not cancel', description: err.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await api.post('/billing/subscriptions/resume', {});
      toast({ title: 'Subscription resumed' });
      await load();
    } catch (err: any) {
      toast({ title: 'Could not resume', description: err.message, variant: 'destructive' });
    } finally {
      setResuming(false);
    }
  };

  const statusInfo = subscription ? STATUS_LABEL[subscription.status] : null;

  return (
    <div>
      <Header title="Billing" subtitle="Manage your WhatsLark subscription plan and payment history" />
      <div className="p-4 sm:p-6 max-w-3xl space-y-4">

        {loading ? (
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        ) : error ? (
          <Card><CardContent className="p-6 text-sm text-destructive">Could not load billing info: {error}</CardContent></Card>
        ) : (
          <>
            {subscription?.status === 'pending_payment' && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Your last payment failed</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Access continues until {fmtDate(subscription.grace_ends_at)}. Update your payment method with Razorpay before then to avoid interruption.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {subscription?.status === 'halted' && (
              <Card className="border-red-300 bg-red-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Subscription halted</p>
                    <p className="text-xs text-red-800 mt-0.5">Payment retries failed. Paid features are restricted. Your data is safe — reactivate anytime.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>Current plan</CardTitle>
                    <CardDescription>Your workspace's active subscription</CardDescription>
                  </div>
                  {statusInfo && <Badge variant={statusInfo.variant as any}>{statusInfo.label}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold capitalize">{subscription.plan_name}</span>
                      <span className="text-muted-foreground text-sm">
                        {formatMoney(subscription.amount_minor, subscription.currency)} / {subscription.billing_interval === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Current period</p>
                        <p className="font-medium">{fmtDate(subscription.current_period_start)} – {fmtDate(subscription.current_period_end)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Next renewal</p>
                        <p className="font-medium">
                          {subscription.cancel_at_period_end
                            ? 'Cancels at period end — no further charge'
                            : fmtDate(subscription.next_charge_at)}
                        </p>
                      </div>
                    </div>

                    {isOwnerAdmin && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link href="/pricing"><Button variant="outline" size="sm"><ArrowUpRight className="w-4 h-4 mr-1.5" />Change plan</Button></Link>
                        {subscription.status === 'paused' ? (
                          <Button variant="outline" size="sm" onClick={handleResume} disabled={resuming}>
                            {resuming ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1.5" />}
                            Resume
                          </Button>
                        ) : !subscription.cancel_at_period_end && subscription.status !== 'cancelled' && subscription.status !== 'completed' ? (
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowCancelConfirm(true)}>
                            <XCircle className="w-4 h-4 mr-1.5" />Cancel at period end
                          </Button>
                        ) : null}
                      </div>
                    )}
                    {!isOwnerAdmin && (
                      <p className="text-xs text-muted-foreground">Only workspace owners or admins can change or cancel the subscription.</p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No active subscription</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">You're on the free plan. Upgrade to unlock more channels, automations and AI credits.</p>
                    {isOwnerAdmin && (
                      <Link href="/pricing"><Button size="sm"><ArrowUpRight className="w-4 h-4 mr-1.5" />View plans</Button></Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {entitlements && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Plan limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    {[
                      ['WhatsApp channels', entitlements.whatsapp_channels],
                      ['Team members', entitlements.team_members],
                      ['Active automations', entitlements.automations],
                      ['Contacts', entitlements.contacts],
                      ['AI credits / month', entitlements.ai_credits_monthly],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between border-b py-1.5 last:border-0">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value === -1 ? 'Unlimited' : value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-b py-1.5 last:border-0">
                      <span className="text-muted-foreground">API access</span>
                      <span className="font-medium">{entitlements.api_access ? 'Enabled' : 'Not available'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Link href="/settings/billing/payments" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Payment history</p>
                <p className="text-xs text-muted-foreground">View past invoices and payments</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          </>
        )}
      </div>

      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              Your plan stays active until the end of the current billing period ({fmtDate(subscription?.current_period_end || null)}).
              After that, your workspace moves to the free plan. Your data, contacts, and message history are never deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Keep plan</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
