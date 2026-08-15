'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, HelpCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

interface SearchResult { source: 'erp' | 'catalog'; id?: string; sku: string; name: string; price: number | null; stock: number | null; }

/** Searches whatever the backend says is authoritative for this company — the
 *  connected ERP's live catalog if one exists, otherwise the manual product_catalog.
 *  Never lets the user pick a manual product when an ERP is connected (backend
 *  enforces this too — this just keeps the picker from offering options that
 *  generateQuote would reject). */
function ProductPicker({ item, onPick }: { item: RfqItem; onPick: (result: SearchResult) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const currentLabel = item.matched_sku
    ? `${item.product_catalog?.name || item.matched_sku} (${item.matched_sku})`
    : '';

  const search = (q: string) => {
    setLoading(true);
    api.get<SearchResult[]>(`/rfq/products/search?q=${encodeURIComponent(q)}`)
      .then((r) => setResults(r || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Input
          className="h-8 text-xs pr-6"
          placeholder="Search products…"
          value={open ? query : currentLabel}
          onFocus={() => { setOpen(true); setQuery(''); search(''); }}
          onChange={(e) => setQuery(e.target.value)}
        />
        {item.matched_sku && !open && (
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onPick({ source: 'catalog', sku: '', name: '', price: null, stock: null }); }}
            title="Clear"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {!item.matched_sku && (
          <Search className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.source}-${r.sku}`}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 flex items-center justify-between gap-2"
                onClick={() => { onPick(r); setOpen(false); }}
              >
                <span className="truncate">{r.name} <span className="text-muted-foreground">({r.sku})</span></span>
                {r.price != null && <span className="shrink-0 font-medium">{r.price}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function RfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [rfq, setRfq] = useState<any>(null);
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

  const reassignItem = async (itemId: string, result: SearchResult) => {
    try {
      if (!result.sku) {
        await api.patch(`/rfq/${id}/items/${itemId}`, { matched_product_id: null });
      } else if (result.source === 'catalog') {
        await api.patch(`/rfq/${id}/items/${itemId}`, { matched_product_id: result.id });
      } else {
        await api.patch(`/rfq/${id}/items/${itemId}`, { matched_sku: result.sku });
      }
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
  const allResolved = items.length > 0 && items.every((i) => i.status !== 'unmatched' && i.matched_sku);

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

        <div className="border rounded-xl overflow-visible bg-white">
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
                      <ProductPicker item={item} onPick={(r) => reassignItem(item.id, r)} />
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
