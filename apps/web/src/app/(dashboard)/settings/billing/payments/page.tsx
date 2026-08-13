'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/razorpay';

interface Payment {
  id: string;
  provider_payment_id: string;
  amount_minor: number;
  currency: string;
  status: 'created' | 'captured' | 'failed' | 'refunded';
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
}

const STATUS: Record<Payment['status'], { label: string; variant: 'success' | 'destructive' | 'secondary' }> = {
  captured: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  refunded: { label: 'Refunded', variant: 'secondary' },
  created: { label: 'Pending', variant: 'secondary' },
};

export default function BillingPaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get<{ data: Payment[]; total: number }>(`/billing/payments?page=${page}&limit=${limit}`)
      .then((res) => { setPayments(res.data); setTotal(res.total || 0); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <Header title="Payment history" subtitle="All charges for your WhatsLark subscription" />
      <div className="p-4 sm:p-6 max-w-3xl space-y-4">
        <Link href="/settings/billing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />Back to billing
        </Link>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : !payments?.length ? (
              <div className="text-center py-12">
                <RotateCcw className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No payments yet</p>
                <p className="text-xs text-muted-foreground mt-1">Payments will appear here once your subscription is active.</p>
              </div>
            ) : (
              <div className="divide-y">
                {payments.map((p) => {
                  const s = STATUS[p.status];
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.status === 'captured'
                          ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                          : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{formatMoney(p.amount_minor, p.currency)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                            {p.payment_method ? ` · ${p.payment_method}` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant={s.variant as any}>{s.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {total > limit && (
          <div className="flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-muted-foreground">Page {page} of {Math.ceil(total / limit)}</span>
            <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
