'use client';

import { useEffect, useState } from 'react';
import { Search, Package, Loader2, Check, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PickedProduct {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
  sku: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (product: PickedProduct) => void;
  selectedId?: string;
}

export function ProductPicker({ open, onClose, onSelect, selectedId }: Props) {
  
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (s = search, p = 1) => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/ecommerce/products?search=${encodeURIComponent(s)}&page=${p}&limit=20`);
      if (p === 1) setProducts(res.data || []);
      else setProducts((prev) => [...prev, ...(res.data || [])]);
      setTotal(res.total || 0);
      setPage(p);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { if (open) { setSearch(''); setPage(1); load('', 1); } }, [open]);

  const handleSearch = (v: string) => { setSearch(v); load(v, 1); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />Products
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products…"
            value={search} onChange={(e) => handleSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading && products.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No products found.<br />
              <span className="text-xs">Sync your store in Settings → Integrations</span>
            </div>
          ) : (
            products.map((p) => (
              <button key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors',
                  selectedId === p.id && 'border-primary bg-primary/5',
                )}>
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    : <Package className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.price != null && <span className="text-sm font-semibold text-primary">{p.price}</span>}
                    {p.sku && <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>}
                    <Badge variant="outline" className={cn('text-[10px]',
                      p.stock_status === 'instock' ? 'text-green-600 border-green-200' : 'text-red-500 border-red-200')}>
                      {p.stock_status === 'instock' ? 'In Stock' : 'Out of Stock'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {(p.ecommerce_connections as any)?.store_name}
                  </p>
                </div>
                {selectedId === p.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            ))
          )}
          {products.length < total && (
            <Button variant="outline" className="w-full" onClick={() => load(search, page + 1)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Load more ({total - products.length} remaining)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
