'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Loader2, CheckCircle2, Truck, XCircle, RefreshCw, AlertCircle, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const EVENT_LABELS: Record<string, string> = {
  order_placed: 'Order Placed',
  order_confirmed: 'Confirmed',
  order_shipped: 'Shipped',
  order_delivered: 'Delivered',
  order_cancelled: 'Cancelled',
  order_refunded: 'Refunded',
};

const EVENT_ICONS: Record<string, any> = {
  order_placed: ShoppingBag,
  order_confirmed: CheckCircle2,
  order_shipped: Truck,
  order_delivered: CheckCircle2,
  order_cancelled: XCircle,
  order_refunded: RefreshCw,
};

const EVENT_COLORS: Record<string, string> = {
  order_placed: 'text-blue-600 bg-blue-50 border-blue-200',
  order_confirmed: 'text-green-600 bg-green-50 border-green-200',
  order_shipped: 'text-purple-600 bg-purple-50 border-purple-200',
  order_delivered: 'text-green-700 bg-green-50 border-green-200',
  order_cancelled: 'text-red-600 bg-red-50 border-red-200',
  order_refunded: 'text-orange-600 bg-orange-50 border-orange-200',
};

export default function EcommercePage() {
  
  const [orders, setOrders] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterConn, setFilterConn] = useState('all');
  const [filterEvent, setFilterEvent] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const [ordersRes, connsRes] = await Promise.all([
        api.get<any>(`/ecommerce/orders?page=${p}&limit=30${filterConn !== 'all' ? `&connection_id=${filterConn}` : ''}${filterEvent !== 'all' ? `&event_type=${filterEvent}` : ''}`),
        api.get<any[]>('/ecommerce/connections'),
      ]);
      if (p === 1) setOrders(ordersRes.data || []);
      else setOrders((prev) => [...prev, ...(ordersRes.data || [])]);
      setTotal(ordersRes.total || 0);
      setConnections(connsRes || []);
      setPage(p);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { load(1); }, [filterConn, filterEvent]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">E-commerce Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">WhatsApp notifications sent for store orders</p>
        </div>
        <Link href="/settings/integrations">
          <Button variant="outline" size="sm">
            <Package className="w-4 h-4 mr-2" />Manage Stores
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(EVENT_LABELS).slice(0, 4).map(([key, label]) => {
          const count = orders.filter((o) => o.event_type === key).length;
          const Icon = EVENT_ICONS[key];
          return (
            <div key={key} className="rounded-xl border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterConn} onValueChange={setFilterConn}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All stores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {connections.map((c) => <SelectItem key={c.id} value={c.id}>{c.store_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEvent} onValueChange={setFilterEvent}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All events" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {Object.entries(EVENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Orders table */}
      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : connections.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No stores connected yet</p>
          <Link href="/settings/integrations">
            <Button className="mt-4">Connect your first store</Button>
          </Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground">
          No order events yet. Orders will appear here when webhooks fire from your store.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Order</th>
                  <th className="text-left px-4 py-2.5 font-medium">Event</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium">Phone</th>
                  <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium">WhatsApp</th>
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const Icon = EVENT_ICONS[o.event_type] || ShoppingBag;
                  return (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">#{o.order_number || o.external_order_id}</p>
                        <p className="text-xs text-muted-foreground">{(o.ecommerce_connections as any)?.store_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', EVENT_COLORS[o.event_type] || 'text-gray-600 bg-gray-50 border-gray-200')}>
                          <Icon className="w-3 h-3" />
                          {EVENT_LABELS[o.event_type] || o.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{o.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{o.customer_phone || '—'}</td>
                      <td className="px-4 py-3 font-medium">
                        {o.total_amount != null ? `${o.currency} ${o.total_amount}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {o.whatsapp_sent
                          ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />Sent</span>
                          : <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertCircle className="w-3.5 h-3.5" />Not sent</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {orders.length < total && (
            <div className="p-3 border-t text-center">
              <Button variant="outline" size="sm" onClick={() => load(page + 1)} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Load more ({total - orders.length} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
