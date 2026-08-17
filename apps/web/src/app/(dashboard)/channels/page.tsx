'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Plus, Phone, CheckCircle, XCircle, Copy, MoreHorizontal,
  Loader2, Eye, EyeOff, RefreshCw, Wifi, WifiOff, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import type { WhatsAppChannel } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';
import { isPlanLimitError, planLimitMessage } from '@/lib/plan-limit';

const BLANK = {
  name: '',
  phone_number: '',
  phone_number_id: '',
  business_account_id: '',
  access_token: '',
  meta_app_id: '',
  app_secret: '',
};

export default function ChannelsPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<WhatsAppChannel | null>(null);
  const [form, setForm] = useState(BLANK);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [diagTarget, setDiagTarget] = useState<WhatsAppChannel | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagTestTo, setDiagTestTo] = useState('');
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [connectingCoexistence, setConnectingCoexistence] = useState(false);
  const signupDataRef = useRef<{ phone_number_id?: string; waba_id?: string }>({});
  const signupModeRef = useRef<'api_only' | 'coexistence'>('api_only');

  // Load the Facebook JS SDK once, for WhatsApp Embedded Signup.
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId || (window as any).FB) return;

    (window as any).fbAsyncInit = () => {
      (window as any).FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Embedded Signup sends the picked phone_number_id/waba_id via postMessage,
  // separately from the FB.login() callback which delivers the auth code.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          signupDataRef.current = { phone_number_id: data.data.phone_number_id, waba_id: data.data.waba_id };
        }
      } catch { /* not a JSON message we care about */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const startEmbeddedSignup = (mode: 'api_only' | 'coexistence') => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
    const setConnecting = mode === 'coexistence' ? setConnectingCoexistence : setConnectingMeta;

    if (!appId || !configId) {
      toast({
        title: 'Not configured',
        description: `Missing env var(s): ${[!appId && 'NEXT_PUBLIC_META_APP_ID', !configId && 'NEXT_PUBLIC_META_CONFIG_ID'].filter(Boolean).join(', ')}. Set on Vercel and redeploy, or use "Add manually".`,
        variant: 'destructive',
      });
      return;
    }

    // Must call FB.login() synchronously within this click handler — any `await`
    // before it breaks the browser's "trusted user gesture" chain and the login
    // popup gets silently blocked (this bit us once already: don't reintroduce it).
    const FB = (window as any).FB;
    if (!FB) {
      toast({
        title: 'Facebook SDK not ready',
        description: 'Wait a couple seconds for the page to finish loading and try again. If it keeps happening, check for an ad-blocker/privacy extension blocking connect.facebook.net.',
        variant: 'destructive',
      });
      return;
    }

    signupDataRef.current = {};
    signupModeRef.current = mode;
    setConnecting(true);

    // Facebook's SDK does its own internal typeof check on the login callback and
    // rejects an `async function` outright ("Expression is of type asyncfunction,
    // not function") even though async functions are perfectly callable — so this
    // must be a plain function. All async work happens in the helper it calls.
    FB.login(
      (response: any) => {
        if (response.authResponse?.code) {
          finishEmbeddedSignup(response.authResponse.code);
        } else {
          setConnecting(false);
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // featureType requests Meta's Coexistence variant of Embedded Signup, which
        // pairs with the phone's WhatsApp Business App instead of taking exclusive
        // Cloud API ownership of the number. Exact param name/value unverified against
        // current Meta docs — confirm before relying on this in production.
        extras: mode === 'coexistence'
          ? { sessionInfoVersion: '3', featureType: 'whatsapp_business_app_onboarding' }
          : { sessionInfoVersion: '3' },
      },
    );
  };

  const handleConnectMeta = () => startEmbeddedSignup('api_only');
  const handleConnectCoexistence = () => startEmbeddedSignup('coexistence');

  const finishEmbeddedSignup = async (code: string) => {
    const mode = signupModeRef.current;
    const setConnecting = mode === 'coexistence' ? setConnectingCoexistence : setConnectingMeta;
    // The postMessage FINISH event can arrive slightly before or after the login callback — wait briefly for it.
    for (let i = 0; i < 20 && !signupDataRef.current.phone_number_id; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const { phone_number_id, waba_id } = signupDataRef.current;
    if (!phone_number_id || !waba_id) {
      setConnecting(false);
      toast({ title: 'Signup incomplete', description: 'No phone number was selected. Try again.', variant: 'destructive' });
      return;
    }
    try {
      const created = await api.post<WhatsAppChannel>('/channels/embedded-signup', { code, phone_number_id, waba_id, connection_mode: mode });
      setChannels((prev) => [created, ...prev]);
      toast({ title: 'WhatsApp connected!', description: created.name });
    } catch (err: any) {
      toast({ title: 'Connection failed', description: err.message, variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/whatsapp`
      : 'https://your-domain.com/api/webhooks/whatsapp';

  const loadChannels = async () => {
    try {
      const data = await api.get<WhatsAppChannel[]>('/channels');
      setChannels(data);
    } catch {
      // Fallback to direct Supabase if API is unreachable
      if (!company?.id) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone_number, phone_number_id, business_account_id, webhook_verify_token, meta_app_id, connection_mode, is_active, created_at, updated_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) setChannels(data as WhatsAppChannel[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [company?.id]);

  // Load or generate the company-level webhook verify token
  useEffect(() => {
    if (!company?.id) return;
    (async () => {
      const supabase = createClient();
      const { data: companyRow } = await supabase
        .from('companies')
        .select('webhook_verify_token')
        .eq('id', company.id)
        .single();

      if (companyRow?.webhook_verify_token) {
        setVerifyToken(companyRow.webhook_verify_token);
      } else {
        const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
        await supabase.from('companies').update({ webhook_verify_token: newToken }).eq('id', company.id);
        setVerifyToken(newToken);
      }
    })();
  }, [company?.id]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(BLANK);
    setShowToken(false);
    setShowDialog(true);
  };

  const openEdit = (ch: WhatsAppChannel) => {
    setEditTarget(ch);
    setForm({
      name: ch.name,
      phone_number: ch.phone_number,
      phone_number_id: ch.phone_number_id,
      business_account_id: ch.business_account_id,
      access_token: '', // never pre-fill; user must re-enter to change
      meta_app_id: ch.meta_app_id || '',
      app_secret: '', // never pre-fill; user must re-enter to change
    });
    setShowToken(false);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone_number || !form.phone_number_id || !form.business_account_id) {
      toast({ title: 'All fields except Meta App ID are required', variant: 'destructive' });
      return;
    }
    if (!editTarget && !form.access_token) {
      toast({ title: 'Access Token is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        // Only send access_token if the user actually entered a new one
        const payload: Record<string, any> = {
          name: form.name,
          phone_number: form.phone_number,
          phone_number_id: form.phone_number_id,
          business_account_id: form.business_account_id,
          meta_app_id: form.meta_app_id || null,
        };
        if (form.access_token) payload.access_token = form.access_token;
        if (form.app_secret) payload.app_secret = form.app_secret;

        const updated = await api.patch<WhatsAppChannel>(`/channels/${editTarget.id}`, payload);
        setChannels((prev) => prev.map((c) => (c.id === editTarget.id ? updated : c)));
        toast({ title: 'Channel updated' });
      } else {
        const created = await api.post<WhatsAppChannel>('/channels', {
          name: form.name,
          phone_number: form.phone_number,
          phone_number_id: form.phone_number_id,
          business_account_id: form.business_account_id,
          access_token: form.access_token,
          meta_app_id: form.meta_app_id || null,
          app_secret: form.app_secret || null,
        });
        setChannels((prev) => [created, ...prev]);
        toast({ title: 'Channel connected', description: 'WhatsApp channel is now active.' });
      }
      setShowDialog(false);
    } catch (err: any) {
      if (isPlanLimitError(err)) {
        toast({ title: 'Plan limit reached', description: planLimitMessage(err), variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ch: WhatsAppChannel) => {
    setToggling(ch.id);
    try {
      const updated = await api.patch<WhatsAppChannel>(`/channels/${ch.id}/toggle`, {});
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
      toast({ title: updated.is_active ? 'Channel activated' : 'Channel paused' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  const handleRemove = async (ch: WhatsAppChannel) => {
    if (!confirm(`Disconnect "${ch.name}"? This will stop all messages on this number.`)) return;
    try {
      await api.delete(`/channels/${ch.id}`);
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      toast({ title: 'Channel removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleTestWebhook = async () => {
    if (!verifyToken) return;
    try {
      const res = await fetch(
        `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=test_ok`,
      );
      const text = await res.text();
      if (res.ok && text === 'test_ok') {
        toast({ title: 'Webhook verified', description: 'The webhook handshake succeeded.' });
      } else {
        toast({ title: 'Webhook test failed', description: `${res.status}: ${text}`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Webhook unreachable', description: err.message, variant: 'destructive' });
    }
  };

  const handleDiagnose = async (ch: WhatsAppChannel, testTo?: string) => {
    setDiagTarget(ch);
    setDiagnosing(true);
    setDiagResult(null);
    try {
      const params = new URLSearchParams({ channel_id: ch.id });
      if (testTo) params.set('to', testTo);
      const res = await fetch(`/api/whatsapp/diagnose?${params}`);
      const json = await res.json();
      setDiagResult(json);
    } catch (err: any) {
      setDiagResult({ error: err.message });
    } finally {
      setDiagnosing(false);
    }
  };

  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribeWebhook = async () => {
    if (!diagTarget) return;
    setSubscribing(true);
    try {
      const res = await fetch('/api/whatsapp/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: diagTarget.id }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const appLevel = json.app_level;
        if (appLevel?.attempted && !appLevel.ok) {
          toast({
            title: 'WABA attached, but app-level field subscribe failed',
            description: appLevel.error_message || 'Check meta_app_id/app_secret and try again.',
            variant: 'destructive',
          });
        } else if (appLevel?.attempted === false) {
          toast({ title: 'WABA attached', description: appLevel.reason, variant: 'destructive' });
        } else {
          toast({ title: 'Webhook subscribed', description: '"messages" field is now subscribed for this WABA.' });
        }
        await handleDiagnose(diagTarget);
      } else {
        toast({ title: 'Subscribe failed', description: json.error_message || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Subscribe failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubscribing(false);
    }
  };

  const [subscribingAll, setSubscribingAll] = useState(false);

  const handleSubscribeAllWebhooks = async () => {
    setSubscribingAll(true);
    try {
      const res = await fetch('/api/whatsapp/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();
      const results: any[] = json.results || [];
      const failed = results.filter((r) => !r.ok);
      const appLevelFailed = results.filter((r) => r.app_level?.attempted && !r.app_level.ok);
      if (failed.length === 0 && appLevelFailed.length === 0) {
        toast({ title: 'All channels subscribed', description: `${results.length} channel(s) confirmed subscribed to webhooks.` });
      } else if (failed.length === 0) {
        toast({
          title: 'WABAs attached, but app-level field subscribe failed',
          description: appLevelFailed.map((f) => `${f.name}: ${f.app_level.error_message}`).join('; '),
          variant: 'destructive',
        });
      } else {
        toast({
          title: `${results.length - failed.length}/${results.length} subscribed`,
          description: failed.map((f) => `${f.name}: ${f.error_message}`).join('; '),
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Subscribe all failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubscribingAll(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  return (
    <div>
      <Header
        title="WhatsApp Channels"
        subtitle="Connect your WhatsApp Business numbers"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleConnectMeta} disabled={connectingMeta}>
              {connectingMeta ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Connect WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={handleConnectCoexistence} disabled={connectingCoexistence} title="Keep using the WhatsApp Business App on this number">
              {connectingCoexistence ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Connect via Coexistence
            </Button>
            <Button size="sm" variant="outline" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add manually</Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* Webhook setup info box */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-blue-900">Meta Webhook Configuration</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-800 hover:bg-blue-100" onClick={handleTestWebhook}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Test webhook
              </Button>
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-800 hover:bg-blue-100" disabled={subscribingAll} onClick={handleSubscribeAllWebhooks}>
                {subscribingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Subscribe all channels
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-blue-700 font-medium">Callback URL</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 flex-1 text-blue-800 truncate">
                {webhookUrl}
              </code>
              <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 border-blue-300" onClick={() => copy(webhookUrl, 'Webhook URL')}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {verifyToken && (
            <div className="space-y-2">
              <p className="text-xs text-blue-700 font-medium">Verify Token</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 flex-1 text-blue-800 truncate">
                  {verifyToken}
                </code>
                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 border-blue-300" onClick={() => copy(verifyToken, 'Verify Token')}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-blue-600">
            In Meta App → WhatsApp → Configuration → Webhook, paste the Callback URL and Verify Token above. Subscribe to <strong>messages</strong> and <strong>message_template_status_update</strong> fields.
          </p>
        </div>

        {/* Channel list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-16 border rounded-lg">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No channels connected</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm mx-auto">
              Connect a WhatsApp Business number to start receiving and sending messages.
            </p>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add your first channel</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <Card key={channel.id} className={channel.is_active ? '' : 'opacity-60'}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${channel.is_active ? 'bg-green-50' : 'bg-muted'}`}>
                      <Phone className={`w-5 h-5 ${channel.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{channel.name}</p>
                        <Badge variant={channel.is_active ? 'success' : 'secondary'} className="shrink-0">
                          {channel.is_active ? 'Active' : 'Paused'}
                        </Badge>
                        {channel.connection_mode === 'coexistence' && (
                          <Badge variant="secondary" className="shrink-0">Coexistence</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{channel.phone_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                        ID: {channel.phone_number_id}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {channel.is_active
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-muted-foreground" />}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(channel)}>
                            Edit channel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDiagTarget(channel); setDiagResult(null); setDiagTestTo(''); }}>
                            <Activity className="w-4 h-4 mr-2" />
                            Diagnose / test send
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggle(channel)}
                            disabled={toggling === channel.id}
                          >
                            {toggling === channel.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : channel.is_active ? (
                              <WifiOff className="w-4 h-4 mr-2" />
                            ) : (
                              <Wifi className="w-4 h-4 mr-2" />
                            )}
                            {channel.is_active ? 'Pause channel' : 'Activate channel'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemove(channel)}
                          >
                            Remove channel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Webhook verify token per channel */}
                  {channel.webhook_verify_token && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">Channel verify token:</span>
                      <code className="font-mono truncate flex-1">{channel.webhook_verify_token}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => copy(channel.webhook_verify_token, 'Token')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Edit WhatsApp Channel' : 'Connect WhatsApp Channel'}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? 'Update channel details. Leave Access Token blank to keep the existing one.'
                : 'Enter credentials from your Meta for Developers app. Credentials are validated before saving.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel name *</Label>
              <Input
                placeholder="Main Support Line"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone number *</Label>
              <Input
                placeholder="+91 98765 43210"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Include country code, e.g. +91 or +971</p>
            </div>

            <div className="space-y-2">
              <Label>Phone Number ID *</Label>
              <Input
                placeholder="From Meta App → WhatsApp → API Setup"
                value={form.phone_number_id}
                onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Business Account ID *</Label>
              <Input
                placeholder="From Meta Business Manager"
                value={form.business_account_id}
                onChange={(e) => setForm({ ...form, business_account_id: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Permanent Access Token {editTarget ? '(leave blank to keep existing)' : '*'}</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder={editTarget ? '••••••••  (unchanged)' : 'EAAx…'}
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
              <p className="text-xs text-muted-foreground">
                Generate a permanent (System User) token in Meta Business Manager.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Meta App ID <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="From Meta App → Settings → Basic"
                value={form.meta_app_id}
                onChange={(e) => setForm({ ...form, meta_app_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Required to upload media headers when submitting message templates for Meta review.
              </p>
            </div>

            <div className="space-y-2">
              <Label>App Secret {editTarget ? '(leave blank to keep existing)' : <span className="text-muted-foreground">(optional)</span>}</Label>
              <Input
                type="password"
                placeholder={editTarget ? '••••••••  (unchanged)' : 'From Meta App → Settings → Basic'}
                value={form.app_secret}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Required to verify incoming webhook signatures and to auto-subscribe webhook fields via Diagnose.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.phone_number || !form.phone_number_id || !form.business_account_id || (!editTarget && !form.access_token)}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {editTarget ? 'Save changes' : 'Connect channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnose / Test Send Dialog */}
      <Dialog open={!!diagTarget} onOpenChange={(open) => { if (!open) { setDiagTarget(null); setDiagResult(null); setDiagTestTo(''); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Diagnose Channel: {diagTarget?.name}</DialogTitle>
            <DialogDescription>
              Checks your Meta credentials and optionally sends a test message to confirm delivery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Test phone (international format, e.g. 971XXXXXXXXX)"
                value={diagTestTo}
                onChange={(e) => setDiagTestTo(e.target.value)}
              />
              <Button
                onClick={() => diagTarget && handleDiagnose(diagTarget, diagTestTo || undefined)}
                disabled={diagnosing}
              >
                {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                <span className="ml-2">Run</span>
              </Button>
            </div>

            {diagResult && (
              <div className="space-y-3 text-sm">
                {/* Token check */}
                {diagResult.checks?.token && (
                  <div className={`rounded-md p-3 border ${diagResult.checks.token.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {diagResult.checks.token.ok
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-600" />}
                      Access Token &amp; Phone Number ID
                    </div>
                    {diagResult.checks.token.ok ? (
                      <div className="text-xs text-green-800 space-y-0.5">
                        <p>Phone: <strong>{diagResult.checks.token.display_phone_number}</strong></p>
                        <p>Name: {diagResult.checks.token.verified_name}</p>
                        <p>Status: {diagResult.checks.token.status} | Quality: {diagResult.checks.token.quality_rating}</p>
                      </div>
                    ) : (
                      <div className="text-xs text-red-800 space-y-1">
                        <p><strong>[{diagResult.checks.token.error_code}]</strong> {diagResult.checks.token.error_message}</p>
                        {diagResult.checks.token.fix && <p className="italic">{diagResult.checks.token.fix}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Webhook signature protection (app_secret) check */}
                {diagResult.checks?.signature_protection && (
                  <div className={`rounded-md p-3 border ${diagResult.checks.signature_protection.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {diagResult.checks.signature_protection.ok
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-600" />}
                      Webhook Signature Protection (App Secret)
                    </div>
                    {diagResult.checks.signature_protection.ok ? (
                      <p className="text-xs text-green-800">App Secret is set — inbound webhooks are verified.</p>
                    ) : (
                      <p className="text-xs text-red-800 italic">{diagResult.checks.signature_protection.fix}</p>
                    )}
                  </div>
                )}

                {/* Webhook subscription check */}
                {diagResult.checks?.webhook_subscription && (
                  <div className={`rounded-md p-3 border ${diagResult.checks.webhook_subscription.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {diagResult.checks.webhook_subscription.ok
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-600" />}
                      Webhook Subscription
                    </div>
                    {diagResult.checks.webhook_subscription.ok ? (
                      <p className="text-xs text-green-800">
                        Subscribed. Fields: {diagResult.checks.webhook_subscription.fields.join(', ')}
                      </p>
                    ) : (
                      <div className="text-xs text-red-800 space-y-1">
                        {diagResult.checks.webhook_subscription.fields && (
                          <p>Current fields: {diagResult.checks.webhook_subscription.fields.join(', ') || '(none)'}</p>
                        )}
                        {diagResult.checks.webhook_subscription.business_account_id && (
                          <p>WABA ID checked: <code>{diagResult.checks.webhook_subscription.business_account_id}</code></p>
                        )}
                        {diagResult.checks.webhook_subscription.raw && (
                          <pre className="text-[10px] bg-white/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(diagResult.checks.webhook_subscription.raw, null, 2)}
                          </pre>
                        )}
                        {diagResult.checks.webhook_subscription.error_message && (
                          <p><strong>[{diagResult.checks.webhook_subscription.error_code}]</strong> {diagResult.checks.webhook_subscription.error_message}</p>
                        )}
                        {diagResult.checks.webhook_subscription.fix && <p className="italic">{diagResult.checks.webhook_subscription.fix}</p>}
                        <Button size="sm" variant="outline" className="mt-1 h-7 text-xs border-red-300" disabled={subscribing} onClick={handleSubscribeWebhook}>
                          {subscribing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          Subscribe webhook
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* App-level webhook field config */}
                {diagResult.checks?.app_level_config && (
                  <div className={`rounded-md p-3 border ${diagResult.checks.app_level_config.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {diagResult.checks.app_level_config.ok
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-600" />}
                      App-level Webhook Config (meta_app_id / app_secret)
                    </div>
                    <div className="text-xs space-y-1">
                      {diagResult.checks.app_level_config.skipped && (
                        <p className="text-red-800 italic">{diagResult.checks.app_level_config.fix}</p>
                      )}
                      {diagResult.checks.app_level_config.all_subscriptions && (
                        <pre className="text-[10px] bg-white/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(diagResult.checks.app_level_config.all_subscriptions, null, 2)}
                        </pre>
                      )}
                      {diagResult.checks.app_level_config.error_message && (
                        <p className="text-red-800"><strong>[{diagResult.checks.app_level_config.error_code}]</strong> {diagResult.checks.app_level_config.error_message}</p>
                      )}
                      {diagResult.checks.app_level_config.fix && !diagResult.checks.app_level_config.skipped && (
                        <p className="text-red-800 italic">{diagResult.checks.app_level_config.fix}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Schema check */}
                {diagResult.checks?.schema_channel_id && (
                  <div className={`rounded-md p-3 border ${diagResult.checks.schema_channel_id.ok ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {diagResult.checks.schema_channel_id.ok
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-yellow-600" />}
                      Database Migration (messages.channel_id)
                    </div>
                    <p className="text-xs">{diagResult.checks.schema_channel_id.detail}</p>
                    {diagResult.checks.schema_channel_id.fix && (
                      <p className="text-xs italic mt-1">{diagResult.checks.schema_channel_id.fix}</p>
                    )}
                  </div>
                )}

                {/* Test send */}
                {diagResult.checks?.test_send && (
                  <div className={`rounded-md p-3 border ${diagResult.checks.test_send.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {diagResult.checks.test_send.ok
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-600" />}
                      Test Message Send → {diagResult.checks.test_send.to}
                    </div>
                    {diagResult.checks.test_send.ok ? (
                      <p className="text-xs text-green-800">Sent! Message ID: {diagResult.checks.test_send.message_id}</p>
                    ) : (
                      <div className="text-xs text-red-800 space-y-1">
                        {diagResult.checks.test_send.phone_warning && (
                          <p className="font-medium text-yellow-800 bg-yellow-50 rounded px-2 py-1">{diagResult.checks.test_send.phone_warning}</p>
                        )}
                        <p><strong>[{diagResult.checks.test_send.error_code}]</strong> {diagResult.checks.test_send.error_message}</p>
                        {diagResult.checks.test_send.fix && <p className="italic">{diagResult.checks.test_send.fix}</p>}
                        {diagResult.checks.test_send.skipped && <p className="text-muted-foreground">{diagResult.checks.test_send.skipped}</p>}
                      </div>
                    )}
                  </div>
                )}

                {diagResult.error && (
                  <div className="rounded-md p-3 border bg-red-50 border-red-200 text-xs text-red-800">
                    {diagResult.error}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  API version used: <code>{diagResult.api_version_used}</code>
                </p>
              </div>
            )}

            {!diagResult && !diagnosing && (
              <p className="text-sm text-muted-foreground">
                Click <strong>Run</strong> to check your credentials. Optionally enter a phone number (with country code, no +) to test-send a message.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDiagTarget(null); setDiagResult(null); setDiagTestTo(''); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
