'use client';

import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import type { SubscriptionPlanConfig } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

const emptyForm = {
  name: '',
  slug: '',
  price_monthly: '',
  price_yearly: '',
  currency: 'USD',
  max_users: '',
  max_channels: '',
  max_contacts: '',
  max_messages_per_month: '',
  features: '',
  is_active: true,
  sort_order: '0',
};

export default function AdminSubscriptionPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlanConfig | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<SubscriptionPlanConfig[]>('/admin/subscription-plans')
      .then(setPlans)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: SubscriptionPlanConfig) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      price_monthly: String(p.price_monthly),
      price_yearly: String(p.price_yearly),
      currency: p.currency,
      max_users: p.max_users != null ? String(p.max_users) : '',
      max_channels: p.max_channels != null ? String(p.max_channels) : '',
      max_contacts: p.max_contacts != null ? String(p.max_contacts) : '',
      max_messages_per_month: p.max_messages_per_month != null ? String(p.max_messages_per_month) : '',
      features: (p.features || []).join('\n'),
      is_active: p.is_active,
      sort_order: String(p.sort_order),
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug) {
      toast({ title: 'Name and slug are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        price_monthly: Number(form.price_monthly) || 0,
        price_yearly: Number(form.price_yearly) || 0,
        currency: form.currency,
        max_users: form.max_users ? Number(form.max_users) : null,
        max_channels: form.max_channels ? Number(form.max_channels) : null,
        max_contacts: form.max_contacts ? Number(form.max_contacts) : null,
        max_messages_per_month: form.max_messages_per_month ? Number(form.max_messages_per_month) : null,
        features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editing) {
        await api.patch(`/admin/subscription-plans/${editing.id}`, payload);
        toast({ title: 'Plan updated' });
      } else {
        await api.post('/admin/subscription-plans', payload);
        toast({ title: 'Plan created' });
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: SubscriptionPlanConfig) => {
    if (!window.confirm(`Delete plan "${p.name}"?`)) return;
    try {
      await api.delete(`/admin/subscription-plans/${p.id}`);
      toast({ title: 'Plan deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Configure plan tiers, limits, and pricing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Edit Plan' : 'New Plan'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price Monthly</Label>
                  <Input type="number" step="0.01" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
                </div>
                <div>
                  <Label>Price Yearly</Label>
                  <Input type="number" step="0.01" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Users</Label>
                  <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} placeholder="Unlimited" />
                </div>
                <div>
                  <Label>Max Channels</Label>
                  <Input type="number" value={form.max_channels} onChange={(e) => setForm({ ...form, max_channels: e.target.value })} placeholder="Unlimited" />
                </div>
                <div>
                  <Label>Max Contacts</Label>
                  <Input type="number" value={form.max_contacts} onChange={(e) => setForm({ ...form, max_contacts: e.target.value })} placeholder="Unlimited" />
                </div>
                <div>
                  <Label>Max Messages / Month</Label>
                  <Input type="number" value={form.max_messages_per_month} onChange={(e) => setForm({ ...form, max_messages_per_month: e.target.value })} placeholder="Unlimited" />
                </div>
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <Textarea rows={4} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sort Order</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-active">Active</Label>
                  <Switch id="is-active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Plan'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {p.name}
                    {p.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                  </CardTitle>
                  <p className="text-2xl font-bold mt-2">{p.currency} {p.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <p className="text-xs text-muted-foreground">{p.currency} {p.price_yearly}/yr</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(p)} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 mb-3">
                  <li className="text-muted-foreground">Users: {p.max_users ?? 'Unlimited'}</li>
                  <li className="text-muted-foreground">Channels: {p.max_channels ?? 'Unlimited'}</li>
                  <li className="text-muted-foreground">Contacts: {p.max_contacts ?? 'Unlimited'}</li>
                  <li className="text-muted-foreground">Messages/mo: {p.max_messages_per_month ?? 'Unlimited'}</li>
                </ul>
                {p.features?.length > 0 && (
                  <ul className="text-sm space-y-1 border-t pt-2">
                    {p.features.map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
