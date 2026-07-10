'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, AlertCircle, ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Connection {
  id: string;
  platform: 'woocommerce' | 'shopify';
  store_name: string;
  store_url: string;
  is_active: boolean;
  last_sync_at: string | null;
  webhook_secret?: string;
}

const PLATFORM_LABELS = { woocommerce: 'WooCommerce', shopify: 'Shopify' };
const PLATFORM_COLORS = { woocommerce: 'bg-purple-100 text-purple-700 border-purple-200', shopify: 'bg-green-100 text-green-700 border-green-200' };

export default function IntegrationsPage() {
  
  const { toast } = useToast();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWebhook, setShowWebhook] = useState<Connection | null>(null);

  const [form, setForm] = useState({
    platform: 'woocommerce' as 'woocommerce' | 'shopify',
    store_name: '',
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
    api_access_token: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<Connection[]>('/ecommerce/connections');
      setConnections(data || []);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ platform: 'woocommerce', store_name: '', store_url: '', consumer_key: '', consumer_secret: '', api_access_token: '' });

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.post('/ecommerce/connections/test', form);
      toast({ title: 'Connection successful ✓' });
    } catch (err: any) {
      toast({ title: 'Connection failed', description: err.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const conn = await api.post<Connection>('/ecommerce/connections', form);
      setConnections((c) => [...c, conn]);
      setShowAdd(false);
      resetForm();
      toast({ title: 'Store connected!' });
      setShowWebhook(conn as Connection);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSync = async (id: string) => {
    setSyncing((s) => ({ ...s, [id]: true }));
    try {
      const res = await api.post<{ synced: number }>(`/ecommerce/connections/${id}/sync`, {});
      toast({ title: `Synced ${res.synced} products` });
      load();
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setSyncing((s) => ({ ...s, [id]: false }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Disconnect this store? This also removes all synced products.')) return;
    setDeleting((d) => ({ ...d, [id]: true }));
    try {
      await api.delete(`/ecommerce/connections/${id}`);
      setConnections((c) => c.filter((x) => x.id !== id));
      toast({ title: 'Store disconnected' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setDeleting((d) => ({ ...d, [id]: false }));
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://whatslark.onrender.com';

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Store Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Connect WooCommerce or Shopify to send order updates via WhatsApp</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus className="w-4 h-4 mr-2" />Connect Store
        </Button>
      </div>

      {/* Feature overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: ShoppingBag, label: 'Order notifications', desc: 'Auto WhatsApp on order placed, shipped, delivered' },
          { icon: Package, label: 'Product catalog', desc: 'Browse and use products in campaigns' },
          { icon: CheckCircle2, label: 'OTP on order', desc: 'Send a 6-digit OTP when order is placed' },
        ].map((f) => (
          <div key={f.label} className="rounded-xl border p-3 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <f.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Connections list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : connections.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No stores connected</p>
          <p className="text-xs text-muted-foreground mt-1">Connect your first WooCommerce or Shopify store</p>
          <Button className="mt-4" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="w-4 h-4 mr-2" />Connect Store
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{conn.store_name}</p>
                  <Badge variant="outline" className={cn('text-xs', PLATFORM_COLORS[conn.platform])}>
                    {PLATFORM_LABELS[conn.platform]}
                  </Badge>
                  <Badge variant={conn.is_active ? 'outline' : 'secondary'} className="text-xs">
                    {conn.is_active ? '● Active' : '○ Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{conn.store_url}</p>
                {conn.last_sync_at && (
                  <p className="text-xs text-muted-foreground">Last sync: {new Date(conn.last_sync_at).toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowWebhook(conn)}>
                  Webhook URL
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSync(conn.id)} disabled={syncing[conn.id]}>
                  {syncing[conn.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span className="ml-1.5">Sync</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(conn.id)} disabled={deleting[conn.id]}
                  className="text-destructive hover:text-destructive">
                  {deleting[conn.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add connection dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v: any) => setForm((f) => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="woocommerce">WooCommerce</SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Store name</Label>
              <Input placeholder="My Store" value={form.store_name} onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Store URL</Label>
              <Input placeholder={form.platform === 'woocommerce' ? 'https://mystore.com' : 'https://mystore.myshopify.com'} value={form.store_url} onChange={(e) => setForm((f) => ({ ...f, store_url: e.target.value }))} />
            </div>
            {form.platform === 'woocommerce' ? (
              <>
                <div className="space-y-1.5">
                  <Label>Consumer Key</Label>
                  <Input placeholder="ck_xxxxxxxx" value={form.consumer_key} onChange={(e) => setForm((f) => ({ ...f, consumer_key: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Consumer Secret</Label>
                  <Input type="password" placeholder="cs_xxxxxxxx" value={form.consumer_secret} onChange={(e) => setForm((f) => ({ ...f, consumer_secret: e.target.value }))} />
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Get keys from WooCommerce → Settings → Advanced → REST API → Add Key
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Admin API Access Token</Label>
                  <Input type="password" placeholder="shpat_xxxxxxxx" value={form.api_access_token} onChange={(e) => setForm((f) => ({ ...f, api_access_token: e.target.value }))} />
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Get token from Shopify Admin → Settings → Apps → Develop apps → Create app → Admin API access token
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Test connection
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook URL dialog */}
      <Dialog open={!!showWebhook} onOpenChange={() => setShowWebhook(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Webhook Setup — {showWebhook?.store_name}</DialogTitle>
          </DialogHeader>
          {showWebhook && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">Add this webhook URL in your {PLATFORM_LABELS[showWebhook.platform]} store to receive order notifications:</p>
              <div className="space-y-3">
                {showWebhook.platform === 'woocommerce' ? (
                  <>
                    <p className="font-medium">WooCommerce → Settings → Advanced → Webhooks → Add webhook</p>
                    <div className="space-y-2">
                      {['Order created', 'Order updated', 'Order deleted'].map((topic, i) => (
                        <div key={topic} className="rounded-lg bg-muted p-2.5">
                          <p className="text-xs font-medium mb-1">{topic}</p>
                          <code className="text-xs break-all">{apiBase}/ecommerce/webhook/{showWebhook.id}/woocommerce</code>
                        </div>
                      ))}
                    </div>
                    {showWebhook.webhook_secret && (
                      <div className="rounded-lg border p-2.5">
                        <p className="text-xs font-medium mb-1">Secret key (paste in WooCommerce webhook secret field):</p>
                        <code className="text-xs">{showWebhook.webhook_secret}</code>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium">Shopify → Settings → Notifications → Webhooks → Create webhook</p>
                    <div className="space-y-2">
                      {['orders/create', 'orders/updated', 'orders/fulfilled', 'orders/cancelled'].map((topic) => (
                        <div key={topic} className="rounded-lg bg-muted p-2.5">
                          <p className="text-xs font-medium mb-1">Topic: {topic}</p>
                          <code className="text-xs break-all">{apiBase}/ecommerce/webhook/{showWebhook.id}/shopify</code>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <Button className="w-full" onClick={() => handleSync(showWebhook.id)}>
                <RefreshCw className="w-4 h-4 mr-2" />Sync products now
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
