'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Phone, CheckCircle, XCircle, MoreHorizontal,
  Loader2, Eye, EyeOff, Wifi, WifiOff, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface VoiceChannel {
  id: string;
  name: string;
  phone_number: string;
  account_sid: string;
  api_key_sid: string;
  twiml_app_sid: string;
  is_active: boolean;
}

const BLANK = {
  name: '',
  phone_number: '',
  account_sid: '',
  auth_token: '',
  api_key_sid: '',
  api_key_secret: '',
  twiml_app_sid: '',
};

export default function VoiceSettingsPage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<VoiceChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<VoiceChannel | null>(null);
  const [form, setForm] = useState(BLANK);
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const voiceWebhookBase =
    typeof window !== 'undefined' ? `${window.location.origin.replace('3000', '3001')}/api/v1/voice/twiml` : '';

  const loadChannels = async () => {
    try {
      const data = await api.get<VoiceChannel[]>('/voice/channels');
      setChannels(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChannels(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm(BLANK);
    setShowSecrets(false);
    setShowDialog(true);
  };

  const openEdit = (ch: VoiceChannel) => {
    setEditTarget(ch);
    setForm({
      name: ch.name,
      phone_number: ch.phone_number,
      account_sid: ch.account_sid,
      auth_token: '',
      api_key_sid: ch.api_key_sid,
      api_key_secret: '',
      twiml_app_sid: ch.twiml_app_sid,
    });
    setShowSecrets(false);
    setShowDialog(true);
  };

  const requiredFilled = form.name && form.phone_number && form.account_sid && form.api_key_sid && form.twiml_app_sid;

  const handleSave = async () => {
    if (!requiredFilled) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    if (!editTarget && (!form.auth_token || !form.api_key_secret)) {
      toast({ title: 'Auth Token and API Key Secret are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        const payload: Record<string, any> = {
          name: form.name,
          phone_number: form.phone_number,
          account_sid: form.account_sid,
          api_key_sid: form.api_key_sid,
          twiml_app_sid: form.twiml_app_sid,
        };
        if (form.auth_token) payload.auth_token = form.auth_token;
        if (form.api_key_secret) payload.api_key_secret = form.api_key_secret;

        const updated = await api.patch<VoiceChannel>(`/voice/channels/${editTarget.id}`, payload);
        setChannels((prev) => prev.map((c) => (c.id === editTarget.id ? updated : c)));
        toast({ title: 'Voice channel updated' });
      } else {
        const created = await api.post<VoiceChannel>('/voice/channels', form);
        setChannels((prev) => [created, ...prev]);
        toast({ title: 'Twilio connected', description: 'Voice calling is now active.' });
      }
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ch: VoiceChannel) => {
    setToggling(ch.id);
    try {
      const updated = await api.patch<VoiceChannel>(`/voice/channels/${ch.id}`, { is_active: !ch.is_active });
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? updated : c)));
      toast({ title: updated.is_active ? 'Channel activated' : 'Channel paused' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  const handleRemove = async (ch: VoiceChannel) => {
    if (!confirm(`Disconnect "${ch.name}"? This will stop all calling on this number.`)) return;
    try {
      await api.delete(`/voice/channels/${ch.id}`);
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      toast({ title: 'Voice channel removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  return (
    <div>
      <Header
        title="Voice Calling"
        subtitle="Connect Twilio for click-to-call and inbound routing"
        actions={<Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Connect Twilio</Button>}
      />

      <div className="p-4 sm:p-6 space-y-6">
        {voiceWebhookBase && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-900">Twilio Webhook Configuration</p>
            <p className="text-xs text-blue-600">
              In your Twilio Console → Phone Numbers → your number → Voice Configuration, set:
            </p>
            <div className="space-y-2">
              <p className="text-xs text-blue-700 font-medium">A call comes in — Webhook</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 flex-1 text-blue-800 truncate">
                  {voiceWebhookBase}/inbound
                </code>
                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 border-blue-300" onClick={() => copy(`${voiceWebhookBase}/inbound`, 'Webhook URL')}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-blue-700 font-medium">Call status changes — Webhook</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 flex-1 text-blue-800 truncate">
                  {voiceWebhookBase}/status-callback
                </code>
                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 border-blue-300" onClick={() => copy(`${voiceWebhookBase}/status-callback`, 'Webhook URL')}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-blue-600">
              Also set your TwiML App's Voice Request URL (used for browser click-to-call) to <code>{voiceWebhookBase}/outbound</code>.
              Recording webhooks are configured automatically per-call.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(1)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-16 border rounded-lg">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No voice channel connected</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm mx-auto">
              Connect your Twilio account to enable click-to-call and inbound call routing.
            </p>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Connect Twilio</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <Card key={channel.id} className={channel.is_active ? '' : 'opacity-60'}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${channel.is_active ? 'bg-green-50' : 'bg-muted'}`}>
                      <Phone className={`w-5 h-5 ${channel.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{channel.name}</p>
                        <Badge variant={channel.is_active ? 'success' : 'secondary'} className="shrink-0">
                          {channel.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{channel.phone_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">SID: {channel.account_sid}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {channel.is_active
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-muted-foreground" />}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(channel)}>Edit channel</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(channel)} disabled={toggling === channel.id}>
                            {toggling === channel.id
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : channel.is_active ? <WifiOff className="w-4 h-4 mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                            {channel.is_active ? 'Pause channel' : 'Activate channel'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleRemove(channel)}>
                            Remove channel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Voice Channel' : 'Connect Twilio'}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? 'Update channel details. Leave secret fields blank to keep the existing values.'
                : 'From your Twilio Console: Account SID + Auth Token (Account dashboard), a Voice API Key SID + Secret (Account → API keys & tokens), and your TwiML App SID (Voice → TwiML Apps). Credentials are validated before saving.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel name *</Label>
              <Input placeholder="Main Support Line" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Twilio phone number *</Label>
              <Input placeholder="+1 555 123 4567" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Account SID *</Label>
              <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={form.account_sid} onChange={(e) => setForm({ ...form, account_sid: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Auth Token {editTarget ? '(leave blank to keep existing)' : '*'}</Label>
              <div className="relative">
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={editTarget ? '••••••••  (unchanged)' : 'From Twilio Console dashboard'}
                  value={form.auth_token}
                  onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
                  className="pr-9"
                />
                <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowSecrets(!showSecrets)}>
                  {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Voice API Key SID *</Label>
              <Input placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={form.api_key_sid} onChange={(e) => setForm({ ...form, api_key_sid: e.target.value })} />
              <p className="text-xs text-muted-foreground">Generate under Account → API keys &amp; tokens → Create API key (Standard). Needed for browser calling.</p>
            </div>
            <div className="space-y-2">
              <Label>Voice API Key Secret {editTarget ? '(leave blank to keep existing)' : '*'}</Label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                placeholder={editTarget ? '••••••••  (unchanged)' : 'Shown once when the API key is created'}
                value={form.api_key_secret}
                onChange={(e) => setForm({ ...form, api_key_secret: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>TwiML App SID *</Label>
              <Input placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={form.twiml_app_sid} onChange={(e) => setForm({ ...form, twiml_app_sid: e.target.value })} />
              <p className="text-xs text-muted-foreground">Create under Voice → TwiML Apps — set its Voice Request URL to the outbound webhook shown above.</p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !requiredFilled || (!editTarget && (!form.auth_token || !form.api_key_secret))}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {editTarget ? 'Save changes' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
