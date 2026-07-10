'use client';

import { useState, useEffect } from 'react';
import {
  Save, Loader2, Building2, Clock, MessageSquare,
  Plus, Trash2, CheckCircle, XCircle, Copy, Eye, EyeOff, ExternalLink, Webhook, Zap, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/store/auth';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Asia/Bangkok',
  'Australia/Sydney', 'Pacific/Auckland',
];

interface Channel {
  id: string;
  name: string;
  phone_number: string;
  phone_number_id: string;
  business_account_id: string;
  access_token: string;
  webhook_verify_token: string;
  is_active: boolean;
  created_at: string;
}

const BLANK = { name: '', phone_number: '', phone_number_id: '', business_account_id: '', access_token: '' };

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, company } = useAuthStore();
  const supabase = createClient();

  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || '' });
  const [companyForm, setCompanyForm] = useState({ name: company?.name || '', timezone: company?.timezone || 'UTC' });
  const [saving, setSaving] = useState<string | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [showToken, setShowToken] = useState(false);
  const [adding, setAdding] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string>('');

  useEffect(() => {
    if (!company?.id) { setLoadingChannels(false); return; }
    (async () => {
      const { data } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) setChannels(data as Channel[]);
      setLoadingChannels(false);
    })();

    // Ensure the company has a persistent webhook verify token so Meta
    // can verify the webhook BEFORE any channel is connected.
    (async () => {
      const { data: companyRow } = await supabase
        .from('companies')
        .select('webhook_verify_token')
        .eq('id', company.id)
        .single();

      if (companyRow?.webhook_verify_token) {
        setVerifyToken(companyRow.webhook_verify_token);
      } else {
        const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
        const { error } = await supabase
          .from('companies')
          .update({ webhook_verify_token: newToken })
          .eq('id', company.id);
        if (!error) setVerifyToken(newToken);
      }
    })();
  }, [company?.id]);

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving('profile');
    const { error } = await supabase.from('users').update({ full_name: profileForm.full_name }).eq('id', user.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Profile updated' });
    setSaving(null);
  };

  const saveCompany = async () => {
    if (!company?.id) return;
    setSaving('company');
    const { error } = await supabase.from('companies').update({ name: companyForm.name, timezone: companyForm.timezone }).eq('id', company.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Workspace updated' });
    setSaving(null);
  };

  const handleConnect = async () => {
    if (!company?.id) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('whatsapp_channels')
      .insert({
        company_id: company.id,
        name: form.name,
        phone_number: form.phone_number,
        phone_number_id: form.phone_number_id,
        business_account_id: form.business_account_id,
        access_token: form.access_token,
        webhook_verify_token: verifyToken,
        is_active: true,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setChannels((prev) => [data as Channel, ...prev]);
      setShowAdd(false);
      setForm(BLANK);
      toast({ title: 'WhatsApp number connected!' });
    }
    setAdding(false);
  };

  const toggleActive = async (ch: Channel) => {
    const { error } = await supabase.from('whatsapp_channels').update({ is_active: !ch.is_active }).eq('id', ch.id);
    if (!error) setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, is_active: !c.is_active } : c));
  };

  const deleteChannel = async (ch: Channel) => {
    if (!confirm(`Disconnect "${ch.name}"? This stops all WhatsApp messages on this number.`)) return;
    const { error } = await supabase.from('whatsapp_channels').delete().eq('id', ch.id);
    if (!error) setChannels((prev) => prev.filter((c) => c.id !== ch.id));
    else toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://whats-lark.vercel.app'}/api/webhooks/whatsapp`;
  const canConnect = form.name && form.phone_number && form.phone_number_id && form.business_account_id && form.access_token;

  return (
    <div>
      <Header title="Settings" subtitle="Manage your profile, workspace, and integrations" />
      <div className="p-4 sm:p-6 max-w-3xl">
        <Tabs defaultValue="profile">
          <TabsList className="mb-6 w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          {/* ── Profile ── */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal info</CardTitle>
                <CardDescription>Update your display name</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <Button onClick={saveProfile} disabled={saving === 'profile'}>
                  {saving === 'profile' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Workspace ── */}
          <TabsContent value="workspace">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" />Workspace</CardTitle>
                <CardDescription>Settings for your company workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Timezone</Label>
                  <Select value={companyForm.timezone} onValueChange={(v) => setCompanyForm({ ...companyForm, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground">Plan</p>
                  <p className="text-sm font-semibold capitalize">{company?.plan} {company?.status === 'trial' ? '(Trial)' : ''}</p>
                </div>
                <Button onClick={saveCompany} disabled={saving === 'company'}>
                  {saving === 'company' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save workspace
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── WhatsApp ── */}
          <TabsContent value="whatsapp" className="space-y-4">

            {/* Step guide */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-green-800">How to connect your WhatsApp Business number</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-green-700">
                <div className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0 font-bold text-[11px]">1</span>
                  <p>Apply for the <strong>WhatsApp Business API</strong> in your <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">Meta Business Manager</a>. Your business and phone number must be approved by Meta.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0 font-bold text-[11px]">2</span>
                  <p>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Meta for Developers</a> → your app → <strong>WhatsApp → API Setup</strong>. Copy your Phone Number ID, WABA ID, and generate a Permanent Access Token.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0 font-bold text-[11px]">3</span>
                  <p>In Meta's <strong>Webhooks</strong> settings, paste the Webhook URL below and the Verify Token shown when connecting.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0 font-bold text-[11px]">4</span>
                  <p>Click <strong>Connect number</strong> below and paste your credentials. Done — WhatsLark will send messages on your behalf.</p>
                </div>
              </CardContent>
            </Card>

            {/* Webhook URL + Verify Token */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Webhook className="w-4 h-4 text-muted-foreground" />Webhook Credentials</CardTitle>
                <CardDescription className="text-xs">Paste both values into Meta Developer Console → WhatsApp → Configuration → Webhooks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Callback URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">{webhookUrl}</code>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(webhookUrl, 'Webhook URL')}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Verify Token</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">{verifyToken}</code>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(verifyToken, 'Verify Token')}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">This token is unique to your account. Copy it and paste it in Meta's Verify Token field when setting up the webhook.</p>
                </div>
              </CardContent>
            </Card>

            {/* Connected numbers */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4" />Connected Numbers</CardTitle>
                  <CardDescription className="text-xs mt-0.5">WhatsApp Business numbers linked to WhatsLark</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowAdd(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-1.5" />Connect number
                </Button>
              </CardHeader>
              <CardContent>
                {loadingChannels ? (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                  </div>
                ) : channels.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No number connected yet</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">Follow the steps above, then connect your number here.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
                      <Plus className="w-4 h-4 mr-1.5" />Connect your first number
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {channels.map((ch) => (
                      <div key={ch.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ch.is_active ? 'bg-green-100' : 'bg-muted'}`}>
                            {ch.is_active
                              ? <CheckCircle className="w-4 h-4 text-green-600" />
                              : <XCircle className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ch.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{ch.phone_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ch.is_active ? 'success' : 'secondary'} className="text-xs">
                            {ch.is_active ? 'Active' : 'Paused'}
                          </Badge>
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => toggleActive(ch)}>
                            {ch.is_active ? 'Pause' : 'Activate'}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteChannel(ch)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Password ── */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change password</CardTitle>
                <CardDescription>Reset your password via email</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
                  else toast({ title: 'Password reset email sent', description: 'Check your inbox.' });
                }}>
                  Send password reset email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick shortcut links */}
        <div className="pt-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">More settings</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { href: '/settings/quick-replies', label: 'Quick Replies', desc: 'Saved message shortcuts for inbox', icon: Zap },
              { href: '/settings/integrations', label: 'Integrations', desc: 'WooCommerce & Shopify stores', icon: ExternalLink },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Connect dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp Business Number</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Display name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Main Support Line"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Just a label for you — not shown to customers.</p>
            </div>

            <div className="space-y-2">
              <Label>Phone number <span className="text-destructive">*</span></Label>
              <Input
                placeholder="+60123456789"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">From Meta Developer Console</p>
            </div>

            <div className="space-y-2">
              <Label>Phone Number ID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. 123456789012345"
                value={form.phone_number_id}
                onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Found in Meta App → WhatsApp → API Setup</p>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Business Account ID (WABA ID) <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. 987654321098765"
                value={form.business_account_id}
                onChange={(e) => setForm({ ...form, business_account_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Found in Meta Business Manager → WhatsApp Accounts</p>
            </div>

            <div className="space-y-2">
              <Label>Permanent Access Token <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={form.access_token}
                  onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Generate a permanent token in Meta System Users — not the temporary test token.</p>
            </div>

            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Meta Cloud API setup guide
            </a>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={adding || !canConnect}>
              {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
