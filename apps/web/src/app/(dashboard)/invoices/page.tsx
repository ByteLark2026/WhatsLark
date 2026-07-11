'use client';

import { useEffect, useState } from 'react';
import { Plus, FileText, DollarSign, Clock, CheckCircle, XCircle, Send, Copy, ExternalLink } from 'lucide-react';
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
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

const STATUS_ICONS: Record<string, any> = {
  draft: FileText, sent: Send, paid: CheckCircle, overdue: Clock, cancelled: XCircle,
};

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  due_date?: string;
  created_at: string;
  public_token: string;
  contacts?: { name?: string };
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    const [list, s] = await Promise.allSettled([
      api.get<any>(`/invoices${statusFilter ? `?status=${statusFilter}` : ''}`),
      api.get<any>('/invoices/stats'),
    ]);
    if (list.status === 'fulfilled') setInvoices(list.value?.data || []);
    if (s.status === 'fulfilled') setStats(s.value);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const createNew = async () => {
    try {
      const inv = await api.post<Invoice>('/invoices', {});
      router.push(`/invoices/${inv.id}`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const markPaid = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.patch(`/invoices/${id}/paid`);
    toast({ title: 'Marked as paid' });
    load();
  };

  const copyLink = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/inv/${inv.public_token}`);
    toast({ title: 'Link copied' });
  };

  const fmt = (n: number, currency = 'AED') => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <Header
        title="Invoices"
        subtitle="Create and track invoices"
        actions={<Button size="sm" onClick={createNew}><Plus className="w-4 h-4 mr-1.5" />New Invoice</Button>}
      />
      <div className="p-4 sm:p-6 space-y-5">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Paid', value: fmt(stats.total_paid), icon: CheckCircle, color: 'text-green-600' },
              { label: 'Outstanding', value: fmt(stats.total_outstanding), icon: Clock, color: 'text-orange-500' },
              { label: 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600' },
              { label: 'Overdue', value: stats.overdue, icon: XCircle, color: 'text-red-600' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <s.icon className={cn('w-4 h-4', s.color)} />
                  </div>
                  <p className="text-lg font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'sent', 'paid', 'overdue'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('text-xs px-3 py-1 rounded-full border transition-colors',
                statusFilter === s ? 'bg-primary text-white border-primary' : 'text-muted-foreground hover:bg-muted')}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-3">No invoices yet</p>
            <Button size="sm" onClick={createNew}>Create first invoice</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const Icon = STATUS_ICONS[inv.status] || FileText;
              return (
                <div key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)}
                  className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/30 cursor-pointer transition-colors">
                  <div className={cn('p-2 rounded-lg', STATUS_STYLES[inv.status])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{inv.number}</span>
                      <Badge className={cn('text-[10px]', STATUS_STYLES[inv.status])}>{inv.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inv.contacts?.name || 'No client'} {inv.due_date ? `· Due ${new Date(inv.due_date).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{fmt(inv.total, inv.currency)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => copyLink(inv, e)} title="Copy link">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {inv.status === 'sent' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={(e) => markPaid(inv.id, e)} title="Mark paid">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
