'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Subscription } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';

type AdminSubscription = Subscription & { companies?: { name: string; slug: string; status: string } | { name: string; slug: string; status: string }[] };

const statusVariant: Record<string, any> = {
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  cancelled: 'destructive',
};

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== 'all') params.set('status', status);
    api.get<{ data: AdminSubscription[]; total: number }>(`/admin/subscriptions?${params.toString()}`)
      .then((res) => { setSubs(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, status]);

  const companyName = (s: AdminSubscription) => {
    const co = s.companies;
    if (!co) return '—';
    return Array.isArray(co) ? co[0]?.name ?? '—' : co.name;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions Data</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} subscriptions across all companies</p>
        </div>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period Start</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period End</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stripe Subscription</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : subs.map((s) => (
              <tr key={s.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{companyName(s)}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{s.plan}</Badge></td>
                <td className="px-4 py-3"><Badge variant={statusVariant[s.status] || 'outline'} className="capitalize">{s.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(s.current_period_start)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(s.current_period_end)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[160px]">{s.stripe_subscription_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
