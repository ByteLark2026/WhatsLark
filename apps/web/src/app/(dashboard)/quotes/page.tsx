'use client';

import { useEffect, useState } from 'react';
import { Plus, FileText, CheckCircle, XCircle, Send, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
};

interface Quotation {
  id: string; number: string; status: string;
  total: number; currency: string;
  valid_until?: string; created_at: string;
  public_token: string;
  contacts?: { name?: string };
}

export default function QuotesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    const [list, s] = await Promise.allSettled([
      api.get<any>(`/quotations${statusFilter ? `?status=${statusFilter}` : ''}`),
      api.get<any>('/quotations/stats'),
    ]);
    if (list.status === 'fulfilled') setQuotes(list.value?.data || []);
    if (s.status === 'fulfilled') setStats(s.value);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const createNew = async () => {
    try {
      const q = await api.post<Quotation>('/quotations', {});
      router.push(`/quotes/${q.id}`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const convert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const inv = await api.post<any>(`/quotations/${id}/convert`);
      toast({ title: 'Converted to invoice', description: inv.number });
      router.push(`/invoices/${inv.id}`);
    } catch {}
  };

  const copyLink = (q: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/q/${q.public_token}`);
    toast({ title: 'Link copied' });
  };

  const fmt = (n: number, currency = 'AED') => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <Header
        title="Quotations"
        subtitle="Create and send quotes to clients"
        actions={<Button size="sm" onClick={createNew}><Plus className="w-4 h-4 mr-1.5" />New Quote</Button>}
      />
      <div className="p-4 sm:p-6 space-y-5">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600' },
              { label: 'Accepted', value: stats.accepted, icon: CheckCircle, color: 'text-green-600' },
              { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600' },
              { label: 'Active value', value: fmt(stats.total_value), icon: FileText, color: 'text-purple-600' },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <s.icon className={cn('w-4 h-4', s.color)} />
                </div>
                <p className="text-lg font-bold">{s.value}</p>
              </CardContent></Card>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'sent', 'accepted', 'rejected', 'converted'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('text-xs px-3 py-1 rounded-full border transition-colors',
                statusFilter === s ? 'bg-primary text-white border-primary' : 'text-muted-foreground hover:bg-muted')}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-3">No quotes yet</p>
            <Button size="sm" onClick={createNew}>Create first quote</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} onClick={() => router.push(`/quotes/${q.id}`)}
                className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/30 cursor-pointer transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{q.number}</span>
                    <Badge className={cn('text-[10px]', STATUS_STYLES[q.status])}>{q.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.contacts?.name || 'No client'} {q.valid_until ? `· Valid until ${new Date(q.valid_until).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{fmt(q.total, q.currency)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(q.created_at)}</p>
                </div>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => copyLink(q, e)} title="Copy link"><Copy className="w-3.5 h-3.5" /></Button>
                  {q.status === 'accepted' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" onClick={(e) => convert(q.id, e)} title="Convert to invoice"><RefreshCw className="w-3.5 h-3.5" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
