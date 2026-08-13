'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatMoney } from '@/lib/razorpay';
import { useRazorpayCheckout } from '@/hooks/use-razorpay-checkout';

interface PriceRow {
  id: string;
  billing_interval: 'monthly' | 'yearly';
  currency: string;
  amount_minor: number;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string;
  features: {
    whatsapp_channels: number;
    team_members: number;
    automations: number;
    contacts: number;
    ai_credits_monthly: number;
    api_access: boolean;
  };
  prices: PriceRow[];
}

function featureLines(f: PlanRow['features']) {
  const fmt = (n: number, label: string) => (n === -1 ? `Unlimited ${label}` : `${n.toLocaleString()} ${label}`);
  return [
    fmt(f.whatsapp_channels, 'WhatsApp channels'),
    fmt(f.team_members, 'team members'),
    fmt(f.automations, 'active automations'),
    fmt(f.contacts, 'contacts'),
    fmt(f.ai_credits_monthly, 'AI credits / month'),
    f.api_access ? 'API access' : 'No API access',
  ];
}

export default function PricingPage() {
  const router = useRouter();
  const { user, company, role } = useAuthStore();
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [interval, setInterval_] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [selectingPriceId, setSelectingPriceId] = useState<string | null>(null);

  const { status, startCheckout } = useRazorpayCheckout(() => {
    router.push('/settings/billing?activated=1');
  });

  useEffect(() => {
    api.get<PlanRow[]>('/billing/plans')
      .then(setPlans)
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get<{ subscription: { plan_code: string } | null }>('/billing/subscription')
      .then((res) => setCurrentPlanCode(res.subscription?.plan_code || null))
      .catch(() => {});
  }, [user]);

  const canOwnerBuy = role === 'owner' || role === 'admin';

  const handleSelect = async (priceId: string) => {
    if (!user) {
      router.push('/login?next=/pricing');
      return;
    }
    if (!canOwnerBuy) {
      alert('Only workspace owners or admins can change the subscription plan.');
      return;
    }
    setSelectingPriceId(priceId);
    await startCheckout(priceId);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <Link href="/" className="text-green-600 font-bold text-xl tracking-tight">WhatsLark</Link>
          <h1 className="text-3xl sm:text-4xl font-bold mt-6 mb-3">Simple, transparent pricing</h1>
          <p className="text-gray-500">Prices in INR. Meta/WhatsApp messaging charges are billed separately by Meta.</p>

          <div className="inline-flex items-center gap-1 mt-6 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setInterval_('monthly')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${interval === 'monthly' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval_('yearly')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${interval === 'yearly' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
            >
              Yearly <span className="text-green-600 text-xs">(save ~17%)</span>
            </button>
          </div>
        </div>

        {loadError && (
          <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
            Could not load plans: {loadError}
          </div>
        )}

        {!plans && !loadError && (
          <div className="grid sm:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => <div key={i} className="h-96 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {plans && (
          <div className="grid sm:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const price = plan.prices.find((p) => p.billing_interval === interval);
              const isCurrent = currentPlanCode === plan.code;
              const isPopular = plan.code === 'professional';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-6 flex flex-col ${isPopular ? 'border-green-500 shadow-lg' : 'border-gray-200'}`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 min-h-[40px]">{plan.description}</p>

                  <div className="mt-4 mb-6">
                    {price ? (
                      <>
                        <span className="text-3xl font-bold">{formatMoney(price.amount_minor, price.currency)}</span>
                        <span className="text-gray-500 text-sm"> / {interval === 'monthly' ? 'month' : 'year'}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">Price unavailable for this interval</span>
                    )}
                  </div>

                  <ul className="space-y-2 text-sm text-gray-700 flex-1 mb-6">
                    {featureLines(plan.features).map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        {line}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : isPopular ? 'default' : 'outline'}
                    disabled={!price || isCurrent || (selectingPriceId === price?.id && status !== 'idle' && status !== 'error')}
                    onClick={() => price && handleSelect(price.id)}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : selectingPriceId === price?.id && status !== 'idle' && status !== 'error'
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{status === 'creating' ? 'Preparing…' : status === 'verifying' ? 'Verifying…' : 'Opening checkout…'}</>
                        : 'Choose plan'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-10">
          Amounts shown are placeholders and subject to change before this feature goes live.
        </p>
      </div>
    </div>
  );
}
