'use client';

import { useEffect, useState } from 'react';
import { Plus, Plug, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type Provider = 'business_central' | 'odoo' | 'woocommerce' | 'shopify' | 'zoho' | 'custom_rest';

const PROVIDER_LABELS: Record<Provider, string> = {
  business_central: 'Microsoft Business Central',
  odoo: 'Odoo',
  woocommerce: 'WooCommerce',
  shopify: 'Shopify',
  zoho: 'Zoho Inventory',
  custom_rest: 'Custom REST API',
};

// Each provider's config (non-secret) vs credentials (encrypted) fields.
const PROVIDER_FIELDS: Record<Provider, { config: { key: string; label: string; placeholder?: string }[]; credentials: { key: string; label: string; placeholder?: string }[] }> = {
  business_central: {
    config: [
      { key: 'tenantId', label: 'Azure AD Tenant ID' },
      { key: 'environment', label: 'Environment', placeholder: 'production' },
      { key: 'companyId', label: 'BC Company ID' },
    ],
    credentials: [
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client Secret' },
    ],
  },
  odoo: {
    config: [
      { key: 'baseUrl', label: 'Odoo URL', placeholder: 'https://mycompany.odoo.com' },
      { key: 'db', label: 'Database name' },
      { key: 'username', label: 'Username' },
    ],
    credentials: [{ key: 'apiKey', label: 'API Key' }],
  },
  woocommerce: {
    config: [{ key: 'storeUrl', label: 'Store URL', placeholder: 'https://mystore.com' }],
    credentials: [
      { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_xxxxxxxx' },
      { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_xxxxxxxx' },
    ],
  },
  shopify: {
    config: [{ key: 'shopDomain', label: 'Shop domain', placeholder: 'mystore.myshopify.com' }],
    credentials: [{ key: 'accessToken', label: 'Admin API Access Token', placeholder: 'shpat_xxxxxxxx' }],
  },
  zoho: {
    config: [{ key: 'organizationId', label: 'Organization ID' }],
    credentials: [
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client Secret' },
      { key: 'refreshToken', label: 'Refresh Token' },
    ],
  },
  custom_rest: {
    config: [
      { key: 'baseUrl', label: 'API Base URL', placeholder: 'https://api.example.com' },
      { key: 'getProductPath', label: 'Get product path', placeholder: '/products/:sku' },
      { key: 'searchPath', label: 'Search path', placeholder: '/products' },
    ],
    credentials: [{ key: 'apiKey', label: 'API Key (Bearer token)' }],
  },
};

interface Connection {
  id: string; provider: Provider; name: string; config: Record<string, string>; is_active: boolean; created_at: string;
}

export default function ErpConnectionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<Provider>('custom_rest');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get<Connection[]>('/integrations/erp');
      setConnections(list || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setProvider('custom_rest');
    setName('');
    setConfig({});
    setCredentials({});
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/integrations/erp', { provider, name, config, credentials });
      setOpen(false);
      await load();
      toast({ title: 'ERP connection saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/integrations/erp/${id}`);
      await load();
      toast({ title: 'Connection removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const fields = PROVIDER_FIELDS[provider];

  return (
    <div>
      <Header
        title="ERP Connections"
        subtitle="Connect a real ERP/commerce system so quotes use live price and stock instead of the manual product catalog"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/rfq')}>Back to RFQs</Button>
            <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Add connection</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : connections.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <Plug className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-1">No ERP connected yet</p>
            <p className="text-xs mb-3">Quotes currently price from the manual product catalog. Connect one of 6 supported providers to switch to live data.</p>
            <Button size="sm" onClick={openNew}>Connect an ERP</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4 border rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{c.name || PROVIDER_LABELS[c.provider]}</span>
                    <Badge variant="outline" className="text-xs">{PROVIDER_LABELS[c.provider]}</Badge>
                    <Badge variant={c.is_active ? 'outline' : 'secondary'} className="text-xs gap-1">
                      <Circle className={cn('w-2 h-2', c.is_active ? 'fill-green-500 text-green-500' : 'fill-muted-foreground text-muted-foreground')} />
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {Object.values(c.config || {}).filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add ERP connection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v: Provider) => { setProvider(v); setConfig({}); setCredentials({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                    <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Connection name</Label>
              <Input placeholder="e.g. Main warehouse" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {fields.config.map((f) => (
              <div className="space-y-1.5" key={f.key}>
                <Label>{f.label}</Label>
                <Input placeholder={f.placeholder} value={config[f.key] || ''} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))} />
              </div>
            ))}
            {fields.credentials.map((f) => (
              <div className="space-y-1.5" key={f.key}>
                <Label>{f.label}</Label>
                <Input type="password" placeholder={f.placeholder} value={credentials[f.key] || ''} onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Credentials are encrypted at rest and never shown again after saving.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save connection'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
