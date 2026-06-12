'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { MessageStatus, MessageDirection } from '@whatslark/shared';
import type { Message } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';

type AdminMessage = Message & { companies?: { name: string; slug: string } | { name: string; slug: string }[] };

const statusVariant: Record<string, any> = {
  sent: 'info',
  delivered: 'success',
  read: 'success',
  failed: 'destructive',
};

export default function AdminMessageLogsPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [direction, setDirection] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== 'all') params.set('status', status);
    if (direction !== 'all') params.set('direction', direction);
    api.get<{ data: AdminMessage[]; total: number }>(`/admin/message-logs?${params.toString()}`)
      .then((res) => { setMessages(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, status, direction]);

  const companyName = (m: AdminMessage) => {
    const co = m.companies;
    if (!co) return '—';
    return Array.isArray(co) ? co[0]?.name ?? '—' : co.name;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Message Logs</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} messages across all companies</p>
        </div>
        <div className="flex gap-2">
          <Select value={direction} onValueChange={(v) => { setPage(1); setDirection(v); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              {Object.values(MessageDirection).map((d) => (
                <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.values(MessageStatus).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Direction</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Content</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : messages.map((m) => (
              <tr key={m.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3">{companyName(m)}</td>
                <td className="px-4 py-3"><Badge variant={m.direction === 'inbound' ? 'secondary' : 'outline'} className="capitalize">{m.direction}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{m.type}</td>
                <td className="px-4 py-3 max-w-[280px] truncate text-muted-foreground">{m.content}</td>
                <td className="px-4 py-3"><Badge variant={statusVariant[m.status] || 'outline'} className="capitalize">{m.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(m.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
