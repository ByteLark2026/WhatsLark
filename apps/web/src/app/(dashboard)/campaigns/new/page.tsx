'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import type { MessageTemplate, WhatsAppChannel } from '@whatslark/shared';

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { company, user } = useAuthStore();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    template_id: '',
    channel_id: '',
    scheduled_at: '',
  });

  useEffect(() => {
    if (!company?.id) { setLoadingData(false); return; }
    const supabase = createClient();
    Promise.all([
      supabase.from('message_templates').select('id, name, category, language, status, components').eq('company_id', company.id).eq('status', 'approved').order('name'),
      supabase.from('whatsapp_channels').select('id, name, phone_number').eq('company_id', company.id).eq('is_active', true),
    ]).then(([tplRes, chRes]) => {
      if (tplRes.data) setTemplates(tplRes.data as unknown as MessageTemplate[]);
      if (chRes.data) setChannels(chRes.data as unknown as WhatsAppChannel[]);
    }).finally(() => setLoadingData(false));
  }, [company?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !user?.id) return;
    if (!form.name || !form.template_id || !form.channel_id) {
      toast({ title: 'Missing fields', description: 'Name, template and channel are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        company_id: company.id,
        name: form.name,
        template_id: form.template_id,
        channel_id: form.channel_id,
        scheduled_at: form.scheduled_at || null,
        status: 'draft',
        created_by: user.id,
        total_recipients: 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        replied_count: 0,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Campaign created', description: `"${form.name}" saved as draft.` });
      router.push('/campaigns');
    }
    setSaving(false);
  };

  return (
    <div>
      <Header
        title="New Campaign"
        subtitle="Broadcast a WhatsApp message to your contacts"
        actions={
          <Link href="/campaigns">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          </Link>
        }
      />

      <div className="p-4 sm:p-6 max-w-2xl">
        {loadingData ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign details</CardTitle>
                <CardDescription>Give your campaign a name and pick when to send it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. June Promo Blast"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Schedule (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to save as draft and schedule later.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message template</CardTitle>
                <CardDescription>Only approved templates can be used for campaigns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No approved templates yet.{' '}
                    <Link href="/templates" className="text-primary hover:underline">Create one first.</Link>
                  </div>
                ) : (
                  <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} <span className="text-muted-foreground ml-1">· {t.category} · {t.language.toUpperCase()}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">WhatsApp channel</CardTitle>
                <CardDescription>The channel used to send this campaign.</CardDescription>
              </CardHeader>
              <CardContent>
                {channels.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No active channels yet.{' '}
                    <Link href="/channels" className="text-primary hover:underline">Connect one first.</Link>
                  </div>
                ) : (
                  <Select value={form.channel_id} onValueChange={(v) => setForm({ ...form, channel_id: v })}>
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
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving || !form.name || !form.template_id || !form.channel_id}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Save as draft
              </Button>
              <Link href="/campaigns"><Button variant="outline" type="button">Cancel</Button></Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
