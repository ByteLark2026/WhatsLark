'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CampaignStatus } from '@whatslark/shared';
import type { Campaign } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';

type AdminCampaign = Campaign & { companies?: { name: string; slug: string } | { name: string; slug: string }[] };

const statusVariant: Record<string, any> = {
  draft: 'outline',
  scheduled: 'info',
  running: 'warning',
  completed: 'success',
  paused: 'secondary',
  failed: 'destructive',
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== 'all') params.set('status', status);
    api.get<{ data: AdminCampaign[]; total: number }>(`/admin/campaigns?${params.toString()}`)
      .then((res) => { setCampaigns(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, status]);

  const companyName = (c: AdminCampaign) => {
    const co = c.companies;
    if (!co) return '—';
    return Array.isArray(co) ? co[0]?.name ?? '—' : co.name;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Master Campaigns</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} campaigns across all companies</p>
        </div>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(CampaignStatus).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[840px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Recipients</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sent</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Delivered</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Read</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : campaigns.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{companyName(c)}</td>
                <td className="px-4 py-3"><Badge variant={statusVariant[c.status] || 'outline'} className="capitalize">{c.status}</Badge></td>
                <td className="px-4 py-3 text-right">{c.total_recipients?.toLocaleString() ?? 0}</td>
                <td className="px-4 py-3 text-right">{c.sent_count?.toLocaleString() ?? 0}</td>
                <td className="px-4 py-3 text-right">{c.delivered_count?.toLocaleString() ?? 0}</td>
                <td className="px-4 py-3 text-right">{c.read_count?.toLocaleString() ?? 0}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
