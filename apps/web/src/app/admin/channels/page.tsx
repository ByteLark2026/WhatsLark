'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { WhatsAppChannel } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';

type AdminChannel = WhatsAppChannel & { companies?: { name: string; slug: string } | { name: string; slug: string }[] };

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    api.get<{ data: AdminChannel[]; total: number }>(`/admin/channels?${params.toString()}`)
      .then((res) => { setChannels(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  const companyName = (c: AdminChannel) => {
    const co = c.companies;
    if (!co) return '—';
    return Array.isArray(co) ? co[0]?.name ?? '—' : co.name;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} WhatsApp channels across all companies</p>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or phone…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Channel Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone Number</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : channels.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone_number}</td>
                <td className="px-4 py-3">{companyName(c)}</td>
                <td className="px-4 py-3"><Badge variant={c.is_active ? 'success' : 'outline'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></td>
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
