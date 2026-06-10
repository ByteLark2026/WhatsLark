'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Upload, MoreHorizontal, Phone, Mail, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { Contact } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ContactsPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) console.error(error);
      if (data) setContacts(data as Contact[]);
      setLoading(false);
    })();
  }, [company?.id]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.phone.includes(q) || c.email?.toLowerCase().includes(q);
  });

  const handleAdd = async () => {
    if (!company?.id) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          company_id: company.id,
          name: form.name || null,
          phone: form.phone,
          email: form.email || null,
        })
        .select('*')
        .single();
      if (error) throw error;
      setContacts((prev) => [data as Contact, ...prev]);
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '' });
      toast({ title: 'Contact added' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header
        title="Contacts"
        subtitle={`${contacts.length} contacts`}
        actions={
          <>
            <Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-2" />Import CSV</Button>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add contact</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="mb-4 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tags</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No contacts found</td></tr>
              ) : filtered.map((contact) => (
                <tr key={contact.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(contact.name || contact.phone)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{contact.name || '—'}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {contact.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contact.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {contact.email}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {contact.last_seen_at ? formatRelativeTime(contact.last_seen_at) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/contacts/${contact.id}`}>View profile</Link></DropdownMenuItem>
                        <DropdownMenuItem>Start conversation</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">Block contact</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone number *</Label>
              <Input placeholder="+1234567890" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
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
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.phone}>Add contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
