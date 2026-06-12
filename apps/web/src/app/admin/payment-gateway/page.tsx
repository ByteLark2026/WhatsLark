'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { PaymentGatewaySettings } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

const PROVIDERS = ['stripe', 'razorpay', 'paypal', 'manual'];

type FormState = {
  is_enabled: boolean;
  is_test_mode: boolean;
  public_key: string;
  secret_key: string;
  webhook_secret: string;
};

const emptyForm: FormState = { is_enabled: false, is_test_mode: true, public_key: '', secret_key: '', webhook_secret: '' };

export default function AdminPaymentGatewayPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, PaymentGatewaySettings & { secret_key_masked?: string | null; webhook_secret_masked?: string | null }>>({});
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<any[]>('/admin/payment-gateway')
      .then((data) => {
        const byProvider: Record<string, any> = {};
        const formsByProvider: Record<string, FormState> = {};
        for (const p of PROVIDERS) {
          const existing = data.find((d) => d.provider === p);
          byProvider[p] = existing || { provider: p, is_enabled: false, is_test_mode: true, config: {} };
          formsByProvider[p] = {
            is_enabled: existing?.is_enabled ?? false,
            is_test_mode: existing?.is_test_mode ?? true,
            public_key: existing?.public_key || '',
            secret_key: '',
            webhook_secret: '',
          };
        }
        setSettings(byProvider);
        setForms(formsByProvider);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateForm = (provider: string, patch: Partial<FormState>) => {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  };

  const handleSave = async (provider: string) => {
    const form = forms[provider];
    setSaving(provider);
    try {
      const payload: any = {
        is_enabled: form.is_enabled,
        is_test_mode: form.is_test_mode,
        public_key: form.public_key,
      };
      if (form.secret_key) payload.secret_key = form.secret_key;
      if (form.webhook_secret) payload.webhook_secret = form.webhook_secret;

      await api.patch(`/admin/payment-gateway/${provider}`, payload);
      toast({ title: `${provider} settings saved` });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Payment Gateway</h1>
        <p className="text-muted-foreground">Configure payment provider credentials and modes</p>
      </div>

      <Tabs defaultValue={PROVIDERS[0]}>
        <TabsList>
          {PROVIDERS.map((p) => <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>)}
        </TabsList>
        {PROVIDERS.map((p) => {
          const form = forms[p] || emptyForm;
          const stored = settings[p];
          return (
            <TabsContent key={p} value={p}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${p}-enabled`}>Enabled</Label>
                    <Switch id={`${p}-enabled`} checked={form.is_enabled} onCheckedChange={(v) => updateForm(p, { is_enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${p}-test`}>Test Mode</Label>
                    <Switch id={`${p}-test`} checked={form.is_test_mode} onCheckedChange={(v) => updateForm(p, { is_test_mode: v })} />
                  </div>
                  <div>
                    <Label>Public Key</Label>
                    <Input value={form.public_key} onChange={(e) => updateForm(p, { public_key: e.target.value })} />
                  </div>
                  <div>
                    <Label>Secret Key</Label>
                    <Input
                      type="password"
                      value={form.secret_key}
                      onChange={(e) => updateForm(p, { secret_key: e.target.value })}
                      placeholder={stored?.secret_key_masked || 'Enter to set/replace'}
                    />
                  </div>
                  <div>
                    <Label>Webhook Secret</Label>
                    <Input
                      type="password"
                      value={form.webhook_secret}
                      onChange={(e) => updateForm(p, { webhook_secret: e.target.value })}
                      placeholder={stored?.webhook_secret_masked || 'Enter to set/replace'}
                    />
                  </div>
                  <Button onClick={() => handleSave(p)} disabled={saving === p}>{saving === p ? 'Saving…' : 'Save Settings'}</Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
