'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Phone, CheckCircle, XCircle, Copy, MoreHorizontal,
  Loader2, Eye, EyeOff, RefreshCw, Wifi, WifiOff,
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

const BLANK = {
  name: '',
  phone_number: '',
  phone_number_id: '',
  business_account_id: '',
  access_token: '',
  meta_app_id: '',
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
        .select('id, name, phone_number, phone_number_id, business_account_id, webhook_verify_token, meta_app_id, is_active, created_at, updated_at')
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
        });
        setChannels((prev) => [created, ...prev]);
        toast({ title: 'Channel connected', description: 'WhatsApp channel is now active.' });
      }
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  return (
    <div>
      <Header
        title="WhatsApp Channels"
        subtitle="Connect your WhatsApp Business numbers"
        actions={<Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add channel</Button>}
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* Webhook setup info box */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-blue-900">Meta Webhook Configuration</p>
            <Button variant="outline" size="sm" className="border-blue-300 text-blue-800 hover:bg-blue-100" onClick={handleTestWebhook}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Test webhook
            </Button>
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
    </div>
  );
}
