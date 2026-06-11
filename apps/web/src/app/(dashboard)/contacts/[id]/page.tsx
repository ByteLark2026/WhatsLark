'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MessageSquare, Edit2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getInitials, formatDate } from '@/lib/utils';
import type { Contact } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) console.error(error);
      if (data) setContact(data as Contact);
      setLoading(false);
    })();
  }, [id]);

  const openEdit = () => {
    if (!contact) return;
    setForm({ name: contact.name || '', email: contact.email || '' });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!contact) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contacts')
      .update({ name: form.name || null, email: form.email || null })
      .eq('id', contact.id)
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setContact(data as Contact);
      setShowEdit(false);
      toast({ title: 'Contact updated' });
    }
    setSaving(false);
  };

  const handleMessage = async () => {
    if (!contact || !company?.id) return;
    setMessaging(true);
    const supabase = createClient();
    try {
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('id')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!channel) {
        toast({ title: 'No WhatsApp channel connected', description: 'Connect a WhatsApp number in Settings first.', variant: 'destructive' });
        return;
      }

      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('company_id', company.id)
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let conversationId = existing?.id;

      if (!conversationId) {
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({
            company_id: company.id,
            contact_id: contact.id,
            channel_id: channel.id,
            status: 'open',
          })
          .select('id')
          .single();
        if (error) throw error;
        conversationId = created.id;
      }

      router.push(`/inbox?conversation=${conversationId}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!contact) return <div className="p-4 sm:p-6 text-muted-foreground">Contact not found</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Link href="/contacts">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Avatar className="w-14 h-14 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {getInitials(contact.name || contact.phone)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{contact.name || contact.phone}</h1>
            <p className="text-muted-foreground">{contact.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={openEdit} className="flex-1 sm:flex-none"><Edit2 className="w-4 h-4 mr-2" />Edit</Button>
          <Button onClick={handleMessage} disabled={messaging} className="flex-1 sm:flex-none">
            {messaging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
            Message
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {contact.phone}
            </div>
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {contact.email}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {contact.tags?.length ? contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                )) : <span className="text-sm text-muted-foreground">No tags</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Added</p>
              <p className="text-sm">{formatDate(contact.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom fields</CardTitle></CardHeader>
          <CardContent>
            {contact.custom_fields && Object.keys(contact.custom_fields).length ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(contact.custom_fields).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No custom fields</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit contact</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="John Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
