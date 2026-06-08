'use client';

import { useEffect, useState } from 'react';
import { Plus, Phone, CheckCircle, XCircle, Copy, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import type { WhatsAppChannel } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

export default function ChannelsPage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone_number: '', phone_number_id: '', business_account_id: '', access_token: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<WhatsAppChannel[]>('/whatsapp/channels')
      .then(setChannels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const channel = await api.post<WhatsAppChannel>('/whatsapp/channels', form);
      setChannels((prev) => [...prev, channel]);
      setShowAdd(false);
      setForm({ name: '', phone_number: '', phone_number_id: '', business_account_id: '', access_token: '' });
      toast({ title: 'Channel connected' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL}/whatsapp/webhook`;

  return (
    <div>
      <Header
        title="WhatsApp Channels"
        subtitle="Connect your WhatsApp Business numbers"
        actions={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add channel</Button>}
      />

      <div className="p-6">
        {/* Webhook info */}
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-1">Webhook URL for Meta</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1 flex-1 text-blue-800 truncate">{webhookUrl}</code>
            <Button variant="outline" size="icon" className="h-7 w-7 border-blue-300" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: 'Copied!' }); }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-blue-700 mt-1">Paste this URL in your Meta App &rarr; WhatsApp &rarr; Configuration &rarr; Webhook URL</p>
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
            <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add channel</Button>
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
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Test webhook</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">Remove</DropdownMenuItem>
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
            <DialogTitle>Connect WhatsApp channel</DialogTitle>
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
              <Input type="password" placeholder="EAAx…" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} />
              <p className="text-xs text-muted-foreground">Generate a permanent token in Meta Business Manager. This is stored encrypted.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.name || !form.phone_number_id}>Connect channel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
