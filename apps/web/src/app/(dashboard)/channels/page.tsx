'use client';

import { useEffect, useState } from 'react';
import { Plus, Phone, CheckCircle, XCircle, Copy, MoreHorizontal, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import type { WhatsAppChannel as BaseWhatsAppChannel } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

type WhatsAppChannel = BaseWhatsAppChannel & { access_token: string };

const BLANK = { name: '', phone_number: '', phone_number_id: '', business_account_id: '', access_token: '' };

export default function ChannelsPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<WhatsAppChannel | null>(null);
  const [form, setForm] = useState(BLANK);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) setChannels(data as WhatsAppChannel[]);
      setLoading(false);
    })();

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

  const openAdd = () => {
    setEditTarget(null);
    setForm(BLANK);
    setShowAdd(true);
  };

  const openEdit = (ch: WhatsAppChannel) => {
    setEditTarget(ch);
    setForm({
      name: ch.name,
      phone_number: ch.phone_number,
      phone_number_id: ch.phone_number_id,
      business_account_id: ch.business_account_id,
      access_token: ch.access_token,
    });
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!company?.id) return;
    setSaving(true);
    const supabase = createClient();

    if (editTarget) {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .update({
          name: form.name,
          phone_number: form.phone_number,
          phone_number_id: form.phone_number_id,
          business_account_id: form.business_account_id,
          access_token: form.access_token,
        })
        .eq('id', editTarget.id)
        .select()
        .single();
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setChannels((prev) => prev.map((c) => c.id === editTarget.id ? (data as WhatsAppChannel) : c));
        setShowAdd(false);
        toast({ title: 'Channel updated' });
      }
    } else {
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
        setChannels((prev) => [data as WhatsAppChannel, ...prev]);
        setShowAdd(false);
        setForm(BLANK);
        toast({ title: 'Channel connected' });
      }
    }
    setSaving(false);
  };

  const handleRemove = async (ch: WhatsAppChannel) => {
    if (!confirm(`Disconnect "${ch.name}"? This stops all WhatsApp messages on this number.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('whatsapp_channels').delete().eq('id', ch.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setChannels((prev) => prev.filter((c) => c.id !== ch.id));
  };

  const handleTestWebhook = async (ch: WhatsAppChannel) => {
    const token = ch.webhook_verify_token || verifyToken;
    try {
      const res = await fetch(`${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=ok`);
      const text = await res.text();
      if (res.ok && text === 'ok') {
        toast({ title: 'Webhook reachable', description: 'Verification handshake succeeded.' });
      } else {
        toast({ title: 'Webhook test failed', description: `Got ${res.status}: ${text}`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Webhook test failed', description: err.message, variant: 'destructive' });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://whats-lark.vercel.app'}/api/webhooks/whatsapp`;
  const canSave = form.name && form.phone_number && form.phone_number_id && form.business_account_id && form.access_token;

  return (
    <div>
      <Header
        title="WhatsApp Channels"
        subtitle="Connect your WhatsApp Business numbers"
        actions={<Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add channel</Button>}
      />

      <div className="p-6">
        {/* Webhook info */}
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-1">Webhook URL for Meta</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1 flex-1 text-blue-800 truncate">{webhookUrl}</code>
            <Button variant="outline" size="icon" className="h-7 w-7 border-blue-300" onClick={() => copy(webhookUrl, 'Webhook URL')}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          {verifyToken && (
            <div className="flex items-center gap-2 mt-2">
              <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1 flex-1 text-blue-800 truncate">{verifyToken}</code>
              <Button variant="outline" size="icon" className="h-7 w-7 border-blue-300" onClick={() => copy(verifyToken, 'Verify Token')}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <p className="text-xs text-blue-700 mt-1">Paste the URL and verify token in Meta App &rarr; WhatsApp &rarr; Configuration &rarr; Webhook</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No channels connected</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Connect a WhatsApp Business number to start messaging.</p>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add channel</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <Card key={channel.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{channel.name}</p>
                      <Badge variant={channel.is_active ? 'success' : 'secondary'}>
                        {channel.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{channel.phone_number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">ID: {channel.phone_number_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {channel.is_active
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-muted-foreground" />}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(channel)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTestWebhook(channel)}>Test webhook</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleRemove(channel)}>Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit WhatsApp channel' : 'Connect WhatsApp channel'}</DialogTitle>
            <DialogDescription>Enter the details from your Meta for Developers app</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel name *</Label>
              <Input placeholder="Main Support Line" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone number *</Label>
              <Input placeholder="+1234567890" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number ID *</Label>
              <Input placeholder="From Meta App → WhatsApp → API Setup" value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Business Account ID *</Label>
              <Input placeholder="WhatsApp Business Account ID" value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Permanent Access Token *</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="EAAx…"
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
              <p className="text-xs text-muted-foreground">Generate a permanent token in Meta Business Manager. This is stored encrypted.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {editTarget ? 'Save changes' : 'Connect channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
