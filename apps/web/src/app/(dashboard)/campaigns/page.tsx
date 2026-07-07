'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Send, Users, CheckCheck, Eye, XCircle, MoreHorizontal,
  Loader2, Search, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { CampaignStatus } from '@whatslark/shared';
import type { Campaign, MessageTemplate, WhatsAppChannel, Contact } from '@whatslark/shared';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const statusBadge: Record<CampaignStatus, { label: string; variant: any }> = {
  draft: { label: 'Draft', variant: 'outline' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  running: { label: 'Running', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  paused: { label: 'Paused', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
};

interface Stats {
  total: number;
  recipients: number;
  deliveryRate: number;
  readRate: number;
  failed: number;
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const { company, user } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, recipients: 0, deliveryRate: 0, readRate: 0, failed: 0 });

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [channelId, setChannelId] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [viewTarget, setViewTarget] = useState<Campaign | null>(null);
  const [viewErrors, setViewErrors] = useState<{ phone: string; error: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    scheduled_at: '',
    auto_retry: false,
  });

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('*, template:message_templates(name, category, language), channel:whatsapp_channels(name, phone_number)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) {
        setCampaigns(data as unknown as Campaign[]);
        const total = data.length;
        const recipients = data.reduce((s, c) => s + (c.total_recipients || 0), 0);
        const totalSent = data.reduce((s, c) => s + (c.sent_count || 0), 0);
        const totalDelivered = data.reduce((s, c) => s + (c.delivered_count || 0), 0);
        const totalRead = data.reduce((s, c) => s + (c.read_count || 0), 0);
        const totalFailed = data.reduce((s, c) => s + (c.failed_count || 0), 0);
        setStats({
          total,
          recipients,
          deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
          readRate: totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0,
          failed: totalFailed,
        });
      }
      setLoading(false);
    })();
  }, [company?.id]);

  const openCreateDialog = async () => {
    setShowCreate(true);
    if (!company?.id) return;
    const supabase = createClient();
    const [tplRes, ctRes, chRes] = await Promise.all([
      supabase.from('message_templates').select('*').eq('company_id', company.id).eq('status', 'approved'),
      supabase.from('contacts').select('id, name, phone').eq('company_id', company.id).eq('is_blocked', false).order('name'),
      supabase.from('whatsapp_channels').select('id, name, phone_number').eq('company_id', company.id).eq('is_active', true),
    ]);
    if (tplRes.data) setTemplates(tplRes.data as unknown as MessageTemplate[]);
    if (ctRes.data) setContacts(ctRes.data as unknown as Contact[]);
    if (chRes.data) {
      setChannels(chRes.data as unknown as WhatsAppChannel[]);
      setChannelId(chRes.data.length === 1 ? chRes.data[0].id : '');
    }
  };

  const closeCreateDialog = () => {
    setShowCreate(false);
    setEditTarget(null);
    setForm({ name: '', description: '', scheduled_at: '', auto_retry: false });
    setSelectedContacts([]);
    setSelectedTemplate(null);
    setChannelId('');
  };

  const openEditDialog = async (campaign: Campaign) => {
    setEditTarget(campaign);
    setForm({
      name: campaign.name,
      description: '',
      scheduled_at: campaign.scheduled_at ? toDatetimeLocalValue(campaign.scheduled_at) : '',
      auto_retry: false,
    });
    setShowCreate(true);
    if (!company?.id) return;
    const supabase = createClient();
    const [tplRes, chRes] = await Promise.all([
      supabase.from('message_templates').select('*').eq('company_id', company.id).eq('status', 'approved'),
      supabase.from('whatsapp_channels').select('id, name, phone_number').eq('company_id', company.id).eq('is_active', true),
    ]);
    if (tplRes.data) {
      const tpls = tplRes.data as unknown as MessageTemplate[];
      setTemplates(tpls);
      setSelectedTemplate(tpls.find((t) => t.id === campaign.template_id) || null);
    }
    if (chRes.data) setChannels(chRes.data as unknown as WhatsAppChannel[]);
    setChannelId(campaign.channel_id);
  };

  const handleSave = async () => {
    if (!company?.id || !user?.id || !form.name || !selectedTemplate || !channelId) return;
    setCreating(true);
    const supabase = createClient();
    if (editTarget) {
      const { data, error } = await supabase
        .from('campaigns')
        .update({
          name: form.name,
          template_id: selectedTemplate.id,
          channel_id: channelId,
          scheduled_at: form.scheduled_at || null,
        })
        .eq('id', editTarget.id)
        .select('*, template:message_templates(name, category, language), channel:whatsapp_channels(name, phone_number)')
        .single();
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setCampaigns((prev) => prev.map((c) => (c.id === editTarget.id ? (data as unknown as Campaign) : c)));
        closeCreateDialog();
        toast({ title: 'Campaign updated' });
      }
    } else {
      try {
        const created = await api.post<{ id: string }>('/campaigns', {
          name: form.name,
          template_id: selectedTemplate.id,
          channel_id: channelId,
          contact_ids: selectedContacts,
          scheduled_at: form.scheduled_at || undefined,
        });

        if (!form.scheduled_at) {
          await api.post(`/campaigns/${created.id}/launch`);
        }

        const { data } = await supabase
          .from('campaigns')
          .select('*, template:message_templates(name, category, language), channel:whatsapp_channels(name, phone_number)')
          .eq('id', created.id)
          .single();

        if (data) setCampaigns((prev) => [data as unknown as Campaign, ...prev]);
        setStats((s) => ({ ...s, total: s.total + 1, recipients: s.recipients + selectedContacts.length }));
        closeCreateDialog();
        toast({
          title: 'Campaign created',
          description: form.scheduled_at ? 'Campaign scheduled.' : 'Campaign launched — sending messages now.',
        });
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    }
    setCreating(false);
  };

  const handleLaunch = async (campaign: Campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/launch`);
      setCampaigns((prev) => prev.map((c) => (
        c.id === campaign.id ? { ...c, status: CampaignStatus.RUNNING, started_at: new Date().toISOString() } : c
      )));
      toast({ title: 'Campaign launched', description: 'Messages are being sent now.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (campaign: Campaign, status: CampaignStatus) => {
    const supabase = createClient();
    const { error } = await supabase.from('campaigns').update({ status }).eq('id', campaign.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status } : c)));
      toast({ title: status === 'paused' ? 'Campaign paused' : 'Campaign resumed' });
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('campaigns').delete().eq('id', campaign.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      setStats((s) => ({ ...s, total: Math.max(0, s.total - 1), recipients: Math.max(0, s.recipients - (campaign.total_recipients || 0)) }));
      toast({ title: 'Campaign deleted' });
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    return (c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
  });

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((c) => c.id));
    }
  };

  return (
    <div>
      <Header
        title="Campaigns"
        subtitle="Create and manage your WhatsApp marketing campaigns"
        actions={
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />Create Campaign
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Campaigns', value: stats.total, sub: `${campaigns.filter(c => c.status === 'running' || c.status === 'scheduled').length} Active` },
            { label: 'Total Recipients', value: stats.recipients.toLocaleString(), sub: `${campaigns.reduce((s, c) => s + (c.sent_count || 0), 0)} Sent` },
            { label: 'Delivery Rate', value: `${stats.deliveryRate}%`, sub: `${campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0)} Delivered` },
            { label: 'Read Rate', value: `${stats.readRate}%`, sub: `${campaigns.reduce((s, c) => s + (c.read_count || 0), 0)} Read` },
            { label: 'Failed Messages', value: stats.failed, sub: `${stats.total > 0 ? Math.round(stats.failed / (campaigns.reduce((s, c) => s + (c.sent_count || 0), 0) || 1) * 100) : 0}% Failed Rate` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign list */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold">All Campaigns</h3>
              <p className="text-sm text-muted-foreground">Manage and monitor your campaigns</p>
            </div>
            {loading ? (
              <div className="space-y-3 p-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16">
                <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No campaigns found</h3>
                <p className="text-muted-foreground mt-1 mb-4">Create your first campaign to get started.</p>
                <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" />Create Campaign</Button>
              </div>
            ) : (
              <div className="divide-y">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                  <div className="col-span-2">Campaign</div>
                  <div>Recipients</div>
                  <div>Delivery Rate</div>
                  <div>Read Rate</div>
                  <div>Actions</div>
                </div>
                {campaigns.map((campaign) => {
                  const badge = statusBadge[campaign.status];
                  const deliveryRate = campaign.sent_count > 0
                    ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) : 0;
                  const readRate = campaign.delivered_count > 0
                    ? Math.round((campaign.read_count / campaign.delivered_count) * 100) : 0;
                  return (
                    <div key={campaign.id} className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-2 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{campaign.name}</p>
                          <Badge variant={badge.variant} className="text-xs flex-shrink-0">{badge.label}</Badge>
                        </div>
                        {campaign.scheduled_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(campaign.scheduled_at, { dateStyle: 'medium', timeStyle: 'short' } as any)}
                          </p>
                        )}
                      </div>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          {campaign.total_recipients.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-green-700">
                          <CheckCheck className="w-3.5 h-3.5" />
                          {deliveryRate}%
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-blue-700">
                          <Eye className="w-3.5 h-3.5" />
                          {readRate}%
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end md:justify-start">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={async () => {
              setViewTarget(campaign);
              setViewErrors([]);
              const supabase = createClient();
              const { data } = await supabase
                .from('campaign_recipients')
                .select('error_message, contacts(phone, name)')
                .eq('campaign_id', campaign.id)
                .eq('status', 'failed');
              if (data?.length) {
                setViewErrors(data.map((r: any) => ({
                  phone: r.contacts?.phone || '?',
                  error: r.error_message || 'Unknown error',
                })));
              }
            }}>View details</DropdownMenuItem>
                            {campaign.status === 'draft' && (
                              <DropdownMenuItem onClick={() => openEditDialog(campaign)}>Edit</DropdownMenuItem>
                            )}
                            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                              <DropdownMenuItem onClick={() => handleLaunch(campaign)}>Launch now</DropdownMenuItem>
                            )}
                            {campaign.status === 'running' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(campaign, CampaignStatus.PAUSED)}>Pause</DropdownMenuItem>
                            )}
                            {campaign.status === 'paused' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(campaign, CampaignStatus.RUNNING)}>Resume</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(campaign)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Showing 1 to {campaigns.length} of {campaigns.length} campaigns
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => (open ? setShowCreate(true) : closeCreateDialog())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Campaign' : 'Create New Campaign'}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {editTarget ? 'Update your campaign details' : 'Choose your campaign type and configure the details'}
            </p>
          </DialogHeader>

          <Tabs defaultValue="contacts">
            <TabsList className="w-full">
              <TabsTrigger value="contacts" className="flex-1">
                <Users className="w-4 h-4 mr-2" />Contacts Import
              </TabsTrigger>
              {!editTarget && (
                <TabsTrigger value="csv" className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />CSV Import
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="contacts" className="space-y-4 mt-4">
              {/* Campaign Info */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">📋</span> Campaign Info
                </h4>
                <div className="space-y-2">
                  <Label>Campaign Name *</Label>
                  <Input
                    placeholder="e.g. Summer Sale Announcement"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Campaign objectives and notes..."
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Template */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">👁</span> Template
                </h4>
                {selectedTemplate ? (
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{selectedTemplate.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedTemplate.category} · {selectedTemplate.language.toUpperCase()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>Change</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
                    📄 Select Template
                  </Button>
                )}
              </div>

              {/* Channel */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">📱</span> WhatsApp channel
                </h4>
                {channels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active channels. <a href="/channels" className="text-primary hover:underline">Connect one first.</a>
                  </p>
                ) : (
                  <Select value={channelId} onValueChange={setChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a channel…" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          {ch.name} <span className="text-muted-foreground ml-1">· {ch.phone_number}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Scheduling */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">🕐</span> Scheduling
                </h4>
                <div className="space-y-2">
                  <Label>Schedule Campaign (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="auto-retry"
                    checked={form.auto_retry}
                    onCheckedChange={(v) => setForm({ ...form, auto_retry: Boolean(v) })}
                  />
                  <Label htmlFor="auto-retry" className="text-sm font-normal cursor-pointer">
                    Enable auto-retry for failed messages
                  </Label>
                </div>
              </div>

              {/* Contact Selection */}
              {!editTarget && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Select Contacts</Label>
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={selectAll}
                    >
                      {selectedContacts.length === filteredContacts.length && filteredContacts.length > 0
                        ? 'Deselect All'
                        : `Select All (${filteredContacts.length})`}
                    </button>
                  </div>
                  <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                    {filteredContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No contacts found</p>
                    ) : (
                      filteredContacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                          <div>
                            <p className="text-sm font-medium">{contact.name || contact.phone}</p>
                            {contact.name && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedContacts.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>
              )}
            </TabsContent>

            {!editTarget && (
              <TabsContent value="csv" className="mt-4">
                <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-3">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="font-medium">Upload a CSV file</p>
                  <p className="text-sm text-muted-foreground">CSV must have columns: phone, name (optional)</p>
                  <Button variant="outline">Choose file</Button>
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={creating || !form.name || !selectedTemplate || !channelId}
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? 'Save Changes' : 'Start Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) { setViewTarget(null); setViewErrors([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewTarget?.name}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={statusBadge[viewTarget.status].variant}>{statusBadge[viewTarget.status].label}</Badge>
                <span className="text-xs text-muted-foreground">Created {formatDate(viewTarget.created_at)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Template</p>
                  <p className="font-medium">{viewTarget.template?.name || '—'}</p>
                  {viewTarget.template && (
                    <p className="text-xs text-muted-foreground">{viewTarget.template.category} · {viewTarget.template.language?.toUpperCase()}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Channel</p>
                  <p className="font-medium">{viewTarget.channel?.name || '—'}</p>
                  {viewTarget.channel && (
                    <p className="text-xs text-muted-foreground">{viewTarget.channel.phone_number}</p>
                  )}
                </div>
                {viewTarget.scheduled_at && (
                  <div>
                    <p className="text-muted-foreground text-xs">Scheduled</p>
                    <p className="font-medium">{formatDate(viewTarget.scheduled_at, { dateStyle: 'medium', timeStyle: 'short' } as any)}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg divide-y">
                {[
                  { label: 'Recipients', value: viewTarget.total_recipients },
                  { label: 'Sent', value: viewTarget.sent_count },
                  { label: 'Delivered', value: viewTarget.delivered_count },
                  { label: 'Read', value: viewTarget.read_count },
                  { label: 'Replied', value: viewTarget.replied_count },
                  { label: 'Failed', value: viewTarget.failed_count },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {viewErrors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-1">
                <XCircle className="w-4 h-4" /> Failed sends ({viewErrors.length})
              </p>
              <div className="border border-destructive/30 rounded-lg divide-y max-h-40 overflow-y-auto">
                {viewErrors.map((e, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <span className="font-medium">{e.phone}</span>
                    <span className="text-muted-foreground ml-2">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Select Template</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No approved templates found. Create templates first.</p>
            ) : (
              templates.map((tpl) => {
                const body = tpl.components?.find((c) => c.type === 'BODY');
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`w-full text-left p-3 border rounded-lg hover:border-primary transition-colors ${selectedTemplate?.id === tpl.id ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => { setSelectedTemplate(tpl); setShowTemplateDialog(false); }}
                  >
                    <p className="font-medium text-sm">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground">{tpl.category} · {tpl.language.toUpperCase()}</p>
                    {body?.text && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{body.text}</p>}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
