'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Package, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_review: 'bg-amber-100 text-amber-700',
  quoted: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
};

interface Rfq {
  id: string; status: string; raw_message: string; created_at: string;
  contacts?: { name?: string; phone?: string };
}

export default function RfqListPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get<any>(`/rfq${statusFilter ? `?status=${statusFilter}` : ''}`);
      setRfqs(list?.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <div>
      <Header
        title="AI RFQ Agent"
        subtitle="WhatsApp purchase requests detected and extracted automatically"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/rfq/erp')}><Plug className="w-4 h-4 mr-1.5" />ERP connections</Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/rfq/products')}><Package className="w-4 h-4 mr-1.5" />Manage products</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'awaiting_review', 'quoted', 'expired'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('text-xs px-3 py-1 rounded-full border transition-colors',
                statusFilter === s ? 'bg-primary text-white border-primary' : 'text-muted-foreground hover:bg-muted')}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : rfqs.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm">No RFQs detected yet</p>
            <p className="text-xs mt-1">Enable the RFQ agent in AI Bot settings, then send a purchase request via WhatsApp.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rfqs.map((r) => (
              <div key={r.id} onClick={() => router.push(`/rfq/${r.id}`)}
                className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/30 cursor-pointer transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{r.contacts?.name || 'Unknown contact'}</span>
                    <Badge className={cn('text-[10px]', STATUS_STYLES[r.status])}>{r.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.raw_message}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">{formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
