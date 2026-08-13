'use client';

import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Price {
  id: string;
  plan_id: string;
  provider: string;
  provider_plan_id: string;
  billing_interval: 'monthly' | 'yearly';
  currency: string;
  amount_minor: number;
  active: boolean;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  features: {
    whatsapp_channels: number;
    team_members: number;
    automations: number;
    contacts: number;
    ai_credits_monthly: number;
    api_access: boolean;
  };
  active: boolean;
  display_order: number;
  prices: Price[];
}

const emptyPlanForm = {
  code: '',
  name: '',
  description: '',
  active: true,
  display_order: '0',
  whatsapp_channels: '1',
  team_members: '1',
  automations: '5',
  contacts: '1000',
  ai_credits_monthly: '100',
  api_access: false,
};

const emptyPriceForm = {
  billing_interval: 'monthly' as 'monthly' | 'yearly',
  provider_plan_id: '',
  amount_rupees: '',
  active: true,
};

function rupees(amountMinor: number) {
  return (amountMinor / 100).toLocaleString('en-IN');
}

export default function AdminBillingPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [savingPlan, setSavingPlan] = useState(false);

  const [priceDialogPlan, setPriceDialogPlan] = useState<Plan | null>(null);
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [priceForm, setPriceForm] = useState(emptyPriceForm);
  const [savingPrice, setSavingPrice] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<Plan[]>('/admin/billing/plans')
      .then(setPlans)
      .catch((err) => toast({ title: 'Error loading plans', description: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // ── Plan dialog ──────────────────────────────────────────────────────────
  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm(emptyPlanForm);
    setPlanDialogOpen(true);
  };

  const openEditPlan = (p: Plan) => {
    setEditingPlan(p);
    setPlanForm({
      code: p.code,
      name: p.name,
      description: p.description || '',
      active: p.active,
      display_order: String(p.display_order),
      whatsapp_channels: String(p.features.whatsapp_channels),
      team_members: String(p.features.team_members),
      automations: String(p.features.automations),
      contacts: String(p.features.contacts),
      ai_credits_monthly: String(p.features.ai_credits_monthly),
      api_access: p.features.api_access,
    });
    setPlanDialogOpen(true);
  };

  const submitPlan = async () => {
    if (!planForm.code || !planForm.name) {
      toast({ title: 'Code and name are required', variant: 'destructive' });
      return;
    }
    setSavingPlan(true);
    try {
      const payload = {
        code: planForm.code,
        name: planForm.name,
        description: planForm.description || null,
        active: planForm.active,
        display_order: Number(planForm.display_order) || 0,
        features: {
          whatsapp_channels: Number(planForm.whatsapp_channels),
          team_members: Number(planForm.team_members),
          automations: Number(planForm.automations),
          contacts: Number(planForm.contacts),
          ai_credits_monthly: Number(planForm.ai_credits_monthly),
          api_access: planForm.api_access,
        },
      };
      if (editingPlan) {
        await api.patch(`/admin/billing/plans/${editingPlan.id}`, payload);
        toast({ title: 'Plan updated' });
      } else {
        await api.post('/admin/billing/plans', payload);
        toast({ title: 'Plan created' });
      }
      setPlanDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingPlan(false);
    }
  };

  const deletePlan = async (p: Plan) => {
    if (!window.confirm(`Delete plan "${p.name}"? This also removes its prices. Existing subscriptions on this plan are unaffected but new ones can't reference it.`)) return;
    try {
      await api.delete(`/admin/billing/plans/${p.id}`);
      toast({ title: 'Plan deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Price dialog ─────────────────────────────────────────────────────────
  const openCreatePrice = (plan: Plan) => {
    setPriceDialogPlan(plan);
    setEditingPrice(null);
    setPriceForm(emptyPriceForm);
  };

  const openEditPrice = (plan: Plan, price: Price) => {
    setPriceDialogPlan(plan);
    setEditingPrice(price);
    setPriceForm({
      billing_interval: price.billing_interval,
      provider_plan_id: price.provider_plan_id,
      amount_rupees: String(price.amount_minor / 100),
      active: price.active,
    });
  };

  const submitPrice = async () => {
    if (!priceDialogPlan) return;
    if (!priceForm.provider_plan_id || !priceForm.amount_rupees) {
      toast({ title: 'Razorpay Plan ID and amount are required', variant: 'destructive' });
      return;
    }
    setSavingPrice(true);
    try {
      const amount_minor = Math.round(Number(priceForm.amount_rupees) * 100);
      if (editingPrice) {
        await api.patch(`/admin/billing/prices/${editingPrice.id}`, {
          provider_plan_id: priceForm.provider_plan_id,
          amount_minor,
          active: priceForm.active,
        });
        toast({ title: 'Price updated' });
      } else {
        await api.post('/admin/billing/prices', {
          plan_id: priceDialogPlan.id,
          provider: 'razorpay',
          provider_plan_id: priceForm.provider_plan_id,
          billing_interval: priceForm.billing_interval,
          currency: 'INR',
          amount_minor,
          active: priceForm.active,
        });
        toast({ title: 'Price created' });
      }
      setPriceDialogPlan(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingPrice(false);
    }
  };

  const deletePrice = async (price: Price) => {
    if (!window.confirm(`Delete this ${price.billing_interval} price? Existing subscriptions on it are unaffected.`)) return;
    try {
      await api.delete(`/admin/billing/prices/${price.id}`);
      toast({ title: 'Price deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Billing Plans (Razorpay)</h1>
          <p className="text-muted-foreground">
            Plans and INR prices shown on <code>/pricing</code> and used by Razorpay Checkout. Separate from the legacy Subscription Plans page.
          </p>
        </div>
        <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreatePlan}><Plus className="w-4 h-4 mr-2" />New Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'New Plan'}</DialogTitle>
              <DialogDescription>Entitlement limits customers get on this plan. Use -1 for unlimited.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code <span className="text-destructive">*</span></Label>
                  <Input placeholder="starter" value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} disabled={!!editingPlan} />
                </div>
                <div>
                  <Label>Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Starter" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>WhatsApp channels</Label>
                  <Input type="number" value={planForm.whatsapp_channels} onChange={(e) => setPlanForm({ ...planForm, whatsapp_channels: e.target.value })} />
                </div>
                <div>
                  <Label>Team members</Label>
                  <Input type="number" value={planForm.team_members} onChange={(e) => setPlanForm({ ...planForm, team_members: e.target.value })} />
                </div>
                <div>
                  <Label>Active automations</Label>
                  <Input type="number" value={planForm.automations} onChange={(e) => setPlanForm({ ...planForm, automations: e.target.value })} />
                </div>
                <div>
                  <Label>Contacts</Label>
                  <Input type="number" value={planForm.contacts} onChange={(e) => setPlanForm({ ...planForm, contacts: e.target.value })} />
                </div>
                <div>
                  <Label>AI credits / month</Label>
                  <Input type="number" value={planForm.ai_credits_monthly} onChange={(e) => setPlanForm({ ...planForm, ai_credits_monthly: e.target.value })} />
                </div>
                <div className="flex items-center justify-between pt-5">
                  <Label htmlFor="api-access">API access</Label>
                  <Switch id="api-access" checked={planForm.api_access} onCheckedChange={(v) => setPlanForm({ ...planForm, api_access: v })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Display order</Label>
                  <Input type="number" value={planForm.display_order} onChange={(e) => setPlanForm({ ...planForm, display_order: e.target.value })} />
                </div>
                <div className="flex items-center justify-between pt-5">
                  <Label htmlFor="plan-active">Active (visible on /pricing)</Label>
                  <Switch id="plan-active" checked={planForm.active} onCheckedChange={(v) => setPlanForm({ ...planForm, active: v })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitPlan} disabled={savingPlan}>
                {savingPlan ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editingPlan ? 'Save changes' : 'Create plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-72 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {p.name}
                    <span className="text-xs font-normal text-muted-foreground">({p.code})</span>
                    {p.active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditPlan(p)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deletePlan(p)} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 mb-4">
                  <li className="text-muted-foreground">Channels: {p.features.whatsapp_channels === -1 ? 'Unlimited' : p.features.whatsapp_channels}</li>
                  <li className="text-muted-foreground">Team members: {p.features.team_members === -1 ? 'Unlimited' : p.features.team_members}</li>
                  <li className="text-muted-foreground">Automations: {p.features.automations === -1 ? 'Unlimited' : p.features.automations}</li>
                  <li className="text-muted-foreground">Contacts: {p.features.contacts === -1 ? 'Unlimited' : p.features.contacts}</li>
                  <li className="text-muted-foreground">AI credits/mo: {p.features.ai_credits_monthly === -1 ? 'Unlimited' : p.features.ai_credits_monthly}</li>
                  <li className="text-muted-foreground">API access: {p.features.api_access ? 'Yes' : 'No'}</li>
                </ul>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prices</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCreatePrice(p)}>
                      <Plus className="w-3 h-3 mr-1" />Add price
                    </Button>
                  </div>
                  {p.prices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No prices yet — add monthly/yearly INR prices with a Razorpay Plan ID.</p>
                  ) : (
                    p.prices.map((price) => (
                      <div key={price.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">₹{rupees(price.amount_minor)} / {price.billing_interval === 'monthly' ? 'mo' : 'yr'}</p>
                          <p className="text-xs text-muted-foreground truncate">{price.provider_plan_id}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {price.active ? <Badge variant="success" className="text-[10px]">Active</Badge> : <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditPrice(p, price)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deletePrice(price)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Price dialog ── */}
      <Dialog open={!!priceDialogPlan} onOpenChange={(open) => !open && setPriceDialogPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPrice ? 'Edit price' : 'Add price'}</DialogTitle>
            <DialogDescription>{priceDialogPlan?.name} — {editingPrice ? editingPrice.billing_interval : 'new price'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingPrice && (
              <div>
                <Label>Billing interval</Label>
                <Select value={priceForm.billing_interval} onValueChange={(v: any) => setPriceForm({ ...priceForm, billing_interval: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Amount (₹) <span className="text-destructive">*</span></Label>
              <Input type="number" step="1" placeholder="999" value={priceForm.amount_rupees} onChange={(e) => setPriceForm({ ...priceForm, amount_rupees: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Stored as paise internally — enter the rupee amount.</p>
            </div>
            <div>
              <Label>Razorpay Plan ID <span className="text-destructive">*</span></Label>
              <Input placeholder="plan_xxxxxxxxxxxxxx" value={priceForm.provider_plan_id} onChange={(e) => setPriceForm({ ...priceForm, provider_plan_id: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">From Razorpay Dashboard → Subscriptions → Plans. Must match this exact interval.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="price-active">Active (selectable on /pricing)</Label>
              <Switch id="price-active" checked={priceForm.active} onCheckedChange={(v) => setPriceForm({ ...priceForm, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitPrice} disabled={savingPrice}>
              {savingPrice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingPrice ? 'Save changes' : 'Add price'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
