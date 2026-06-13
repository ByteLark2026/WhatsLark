'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { TemplateStatus } from '@whatslark/shared';
import type { MessageTemplate } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';

type AdminTemplate = MessageTemplate & { companies?: { name: string; slug: string } | { name: string; slug: string }[] };

const statusVariant: Record<string, any> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== 'all') params.set('status', status);
    api.get<{ data: AdminTemplate[]; total: number }>(`/admin/templates?${params.toString()}`)
      .then((res) => { setTemplates(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, status]);

  const companyName = (t: AdminTemplate) => {
    const co = t.companies;
    if (!co) return '—';
    return Array.isArray(co) ? co[0]?.name ?? '—' : co.name;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Master Templates</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} message templates across all companies</p>
        </div>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(TemplateStatus).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Template</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Language</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : templates.map((t) => (
              <tr key={t.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3">{companyName(t)}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.language}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{t.category?.toLowerCase()}</Badge></td>
                <td className="px-4 py-3"><Badge variant={statusVariant[t.status] || 'outline'} className="capitalize">{t.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
