'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Send, CheckCircle, XCircle, RefreshCw, Copy, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
};

interface LineItem { id: string; description: string; qty: number; unit_price: number; amount: number; }
function uid() { return Math.random().toString(36).slice(2); }
function newItem(): LineItem { return { id: uid(), description: '', qty: 1, unit_price: 0, amount: 0 }; }

export default function QuoteBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([newItem()]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [currency, setCurrency] = useState('AED');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<any>(`/quotations/${id}`).then((data) => {
      setQuote(data);
      setLineItems(data.line_items?.length ? data.line_items : [newItem()]);
      setTaxRate(data.tax_rate || 0); setDiscount(data.discount || 0);
      setCurrency(data.currency || 'AED'); setValidUntil(data.valid_until || '');
      setNotes(data.notes || ''); setTerms(data.terms || '');
    });
  }, [id]);

  const updateItem = (itemId: string, field: keyof LineItem, val: any) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: val };
      updated.amount = updated.qty * updated.unit_price;
      return updated;
    }));
  };

  const subtotal = lineItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = Math.max(0, subtotal + taxAmount - discount);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<any>(`/quotations/${id}`, {
        line_items: lineItems, tax_rate: taxRate, discount, currency, valid_until: validUntil, notes, terms,
      });
      setQuote(updated);
      toast({ title: 'Saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const action = async (path: string, label: string) => {
    await save();
    const updated = await api.patch<any>(`/quotations/${id}/${path}`);
    setQuote(updated); toast({ title: label });
  };

  const convert = async () => {
    try {
      const inv = await api.post<any>(`/quotations/${id}/convert`);
      toast({ title: 'Converted!', description: `Invoice ${inv.number} created` });
      router.push(`/invoices/${inv.id}`);
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/q/${quote?.public_token}`);
    toast({ title: 'Link copied' });
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const editable = !['accepted','rejected','converted'].includes(quote?.status);

  if (!quote) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <Header
        title={quote.number}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => router.push('/quotes')}><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back</Button>
            <Button variant="outline" size="sm" onClick={copyLink}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy link</Button>
            {quote.status === 'draft' && <Button variant="outline" size="sm" onClick={() => action('send', 'Marked as sent')}><Send className="w-3.5 h-3.5 mr-1.5" />Mark sent</Button>}
            {quote.status === 'sent' && <>
              <Button variant="outline" size="sm" className="text-green-700" onClick={() => action('accept', 'Accepted')}><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Accept</Button>
              <Button variant="outline" size="sm" className="text-red-600" onClick={() => action('reject', 'Rejected')}><XCircle className="w-3.5 h-3.5 mr-1.5" />Reject</Button>
            </>}
            {quote.status === 'accepted' && <Button variant="outline" size="sm" className="text-purple-700" onClick={convert}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Convert to Invoice</Button>}
            {editable && <Button size="sm" onClick={save} disabled={saving}><Save className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Saving…' : 'Save'}</Button>}
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Badge className={cn('text-xs', STATUS_STYLES[quote.status])}>{quote.status}</Badge>
          {quote.contacts?.name && <span className="text-sm text-muted-foreground">Client: <strong>{quote.contacts.name}</strong></span>}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-8" disabled={!editable} /></div>
          <div className="space-y-1.5"><Label>Valid until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-8" disabled={!editable} /></div>
          <div className="space-y-1.5"><Label>Tax rate (%)</Label><Input type="number" value={taxRate} onChange={(e) => setTaxRate(+e.target.value)} className="h-8" disabled={!editable} /></div>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Description</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground w-20">Qty</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground w-28">Unit price</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground w-24">Amount</th>
                {editable && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2"><Input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} className="h-8 border-0 shadow-none px-0 focus-visible:ring-0" placeholder="Item…" disabled={!editable} /></td>
                  <td className="px-3 py-2"><Input type="number" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', +e.target.value)} className="h-8 text-right w-16 ml-auto" min={1} disabled={!editable} /></td>
                  <td className="px-3 py-2"><Input type="number" value={item.unit_price} onChange={(e) => updateItem(item.id, 'unit_price', +e.target.value)} className="h-8 text-right" min={0} disabled={!editable} /></td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(item.qty * item.unit_price)}</td>
                  {editable && <td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setLineItems((p) => p.filter((i) => i.id !== item.id))}><Trash2 className="w-3 h-3" /></Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {editable && (
            <div className="px-4 py-2 border-t">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLineItems((p) => [...p, newItem()])}><Plus className="w-3.5 h-3.5 mr-1.5" />Add line item</Button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currency} {fmt(subtotal)}</span></div>
            {taxRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{currency} {fmt(taxAmount)}</span></div>}
            {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{currency} {fmt(discount)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{currency} {fmt(total)}</span></div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-24" disabled={!editable} /></div>
          <div className="space-y-1.5"><Label>Terms & conditions</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="h-24" disabled={!editable} /></div>
        </div>
      </div>
    </div>
  );
}
