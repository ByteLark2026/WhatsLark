'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_review: 'bg-amber-100 text-amber-700',
  quoted: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
};

const ITEM_STATUS: Record<string, { label: string; className: string; icon: any }> = {
  auto_matched: { label: 'Matched', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  needs_review: { label: 'Needs review', className: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  unmatched: { label: 'Unmatched', className: 'bg-red-100 text-red-700', icon: HelpCircle },
};

interface RfqItem {
  id: string; raw_text: string; quantity: number | null; unit: string | null;
  matched_product_id: string | null; matched_sku: string | null; confidence: number | null; status: string;
  product_catalog?: { id: string; sku: string; name: string; standard_price: number; currency: string } | null;
}

interface Product { id: string; sku: string; name: string; standard_price: number; }

export default function RfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [rfq, setRfq] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<any>(`/rfq/${id}`);
      setRfq(data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!company?.id) return;
    createClient()
      .from('product_catalog')
      .select('id, sku, name, standard_price')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => setProducts(data || []));
  }, [company?.id]);

  const reassignItem = async (itemId: string, productId: string) => {
    try {
      await api.patch(`/rfq/${id}/items/${itemId}`, { matched_product_id: productId || null });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const generateQuote = async () => {
    setGenerating(true);
    try {
      const quote = await api.post<any>(`/rfq/${id}/quote`);
      toast({ title: 'Quotation created', description: quote.number });
      router.push(`/quotes/${quote.id}`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  if (!rfq) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const items: RfqItem[] = rfq.items || [];
  const allResolved = items.length > 0 && items.every((i) => i.status !== 'unmatched' && i.matched_product_id);

  return (
    <div>
      <Header
        title="RFQ review"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/rfq')}><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back</Button>
            {rfq.status !== 'quoted' && (
              <Button size="sm" onClick={generateQuote} disabled={!allResolved || generating}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />{generating ? 'Generating…' : 'Generate quotation'}
              </Button>
            )}
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <div className="bg-white border rounded-xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Badge className={cn('text-xs', STATUS_STYLES[rfq.status])}>{rfq.status.replace('_', ' ')}</Badge>
            {rfq.contacts?.name && (
              <span className="text-sm text-muted-foreground">
                From: <strong>{rfq.contacts.name}</strong>{rfq.contacts.phone ? ` (${rfq.contacts.phone})` : ''}
              </span>
            )}
          </div>
          <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{rfq.raw_message}</p>
        </div>

        <div className="border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Requested item</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground w-20">Qty</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground w-64">Matched product</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground w-32">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const statusInfo = ITEM_STATUS[item.status] || ITEM_STATUS.unmatched;
                const StatusIcon = statusInfo.icon;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{item.raw_text}</p>
                      {item.unit && <p className="text-xs text-muted-foreground">{item.unit}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{item.quantity ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <Select value={item.matched_product_id || ''} onValueChange={(v) => reassignItem(item.id, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select product…" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name} ({p.sku})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={cn('text-[10px] gap-1', statusInfo.className)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}{item.confidence != null ? ` · ${item.confidence}%` : ''}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!allResolved && rfq.status !== 'quoted' && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Resolve every item (assign a product) before a quotation can be generated.
          </p>
        )}
      </div>
    </div>
  );
}
