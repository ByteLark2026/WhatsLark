'use client';

import { useEffect, useState } from 'react';
import { Plus, Package, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/layout/header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface Product {
  id: string; sku: string; name: string; aliases: string[];
  cost: number | null; standard_price: number | null; currency: string; is_active: boolean;
}

function emptyForm() {
  return { id: '', sku: '', name: '', aliases: '', cost: '', standard_price: '', currency: 'AED' };
}

export default function ProductCatalogPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get<Product[]>('/rfq/products');
      setProducts(list || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (p: Product) => {
    setForm({
      id: p.id, sku: p.sku, name: p.name, aliases: (p.aliases || []).join(', '),
      cost: p.cost != null ? String(p.cost) : '', standard_price: p.standard_price != null ? String(p.standard_price) : '',
      currency: p.currency,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.sku.trim() || !form.name.trim()) {
      toast({ title: 'SKU and name are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
      cost: form.cost ? Number(form.cost) : null,
      standard_price: form.standard_price ? Number(form.standard_price) : null,
      currency: form.currency || 'AED',
    };
    try {
      if (form.id) await api.patch(`/rfq/products/${form.id}`, payload);
      else await api.post('/rfq/products', payload);
      setOpen(false);
      await load();
      toast({ title: form.id ? 'Product updated' : 'Product added' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/rfq/products/${id}`);
      setProducts((p) => p.filter((x) => x.id !== id));
      toast({ title: 'Product deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <Header
        title="Product Catalog"
        subtitle="Products the AI RFQ Agent matches WhatsApp requests against"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/rfq')}>Back to RFQs</Button>
            <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Add product</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-3">No products yet</p>
            <Button size="sm" onClick={openNew}>Add your first product</Button>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">SKU</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Aliases</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground w-24">Cost</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground w-24">Price</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{(p.aliases || []).join(', ')}</td>
                    <td className="px-3 py-2.5 text-right">{p.cost != null ? `${p.currency} ${p.cost}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{p.standard_price != null ? `${p.currency} ${p.standard_price}` : '—'}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit product' : 'Add product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Aliases (comma-separated)</Label>
              <Input placeholder="alternate names customers might use" value={form.aliases} onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Helps the AI match informal product names from WhatsApp messages to this SKU.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Cost</Label><Input type="number" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Selling price</Label><Input type="number" value={form.standard_price} onChange={(e) => setForm((f) => ({ ...f, standard_price: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
