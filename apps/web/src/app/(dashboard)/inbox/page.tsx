'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConversationList } from '@/components/inbox/conversation-list';
import { ChatWindow } from '@/components/inbox/chat-window';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { ConversationStatus } from '@whatslark/shared';
import type { Conversation, WhatsAppChannel, Contact } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

export default function InboxPage() {
  const { company, user } = useAuthStore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get('conversation');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConversationStatus | 'all'>(ConversationStatus.OPEN);
  const [search, setSearch] = useState('');

  // New conversation dialog state
  const [showNew, setShowNew] = useState(false);
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [newForm, setNewForm] = useState({ channel_id: '', contact_id: '', message: '' });
  const [creating, setCreating] = useState(false);

  const loadConversations = async () => {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('conversations')
      .select('*, contact:contacts(id, name, phone, avatar_url, email), channel:whatsapp_channels(id, name, phone_number, is_active)')
      .eq('company_id', company.id)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (!error && data) setConversations(data as unknown as Conversation[]);
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, [company?.id, status]);

  // Auto-select from URL param
  useEffect(() => {
    if (!conversationParam || !company?.id) return;
    const fromList = conversations.find((c) => c.id === conversationParam);
    if (fromList) { setSelected(fromList); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, contact:contacts(id, name, phone, avatar_url, email), channel:whatsapp_channels(id, name, phone_number, is_active)')
        .eq('id', conversationParam)
        .eq('company_id', company.id)
        .maybeSingle();
      if (data) setSelected(data as unknown as Conversation);
    })();
  }, [conversationParam, conversations, company?.id]);

  // Load channels + contacts for new conversation dialog
  useEffect(() => {
    if (!company?.id) return;
    const supabase = createClient();
    supabase
      .from('whatsapp_channels')
      .select('id, name, phone_number, is_active')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          setChannels(data as WhatsAppChannel[]);
          if (data.length === 1) setNewForm((f) => ({ ...f, channel_id: data[0].id }));
        }
      });

    supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('company_id', company.id)
      .order('name', { nullsFirst: false })
      .limit(200)
      .then(({ data }) => { if (data) setContacts(data as Contact[]); });
  }, [company?.id]);

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const filteredConversations = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contact?.name?.toLowerCase().includes(q) ||
      c.contact?.phone?.includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  });

  const handleStatusChange = (id: string, newStatus: Conversation['status']) => {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleNewConversation = async () => {
    if (!newForm.channel_id || !newForm.contact_id || !company?.id) return;
    setCreating(true);
    const supabase = createClient();
    try {
      // Find or create conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('*, contact:contacts(id, name, phone, avatar_url, email), channel:whatsapp_channels(id, name, phone_number, is_active)')
        .eq('company_id', company.id)
        .eq('contact_id', newForm.contact_id)
        .eq('channel_id', newForm.channel_id)
        .neq('status', 'closed')
        .maybeSingle();

      let conv = existing as unknown as Conversation | null;

      if (!conv) {
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({
            company_id: company.id,
            contact_id: newForm.contact_id,
            channel_id: newForm.channel_id,
            status: 'open',
            unread_count: 0,
          })
          .select('*, contact:contacts(id, name, phone, avatar_url, email), channel:whatsapp_channels(id, name, phone_number, is_active)')
          .single();
        if (error) throw error;
        conv = created as unknown as Conversation;
      }

      if (!conv) throw new Error('Could not create conversation');

      // If user typed a message, send it
      if (newForm.message.trim()) {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conv.id,
            company_id: company.id,
            sender_id: user?.id,
            message: newForm.message.trim(),
            is_note: false,
          }),
        });
        const json = await res.json();
        if (!res.ok && res.status !== 207) {
          toast({ title: 'Conversation created but message failed', description: json.error, variant: 'destructive' });
        }
      }

      setShowNew(false);
      setNewForm({ channel_id: channels.length === 1 ? channels[0].id : '', contact_id: '', message: '' });
      setContactSearch('');

      // Add to list and select
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv!.id);
        return exists ? prev : [conv!, ...prev];
      });
      setSelected(conv);
      toast({ title: 'Conversation started' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className={cn('w-full sm:w-80 flex-col border-r bg-background', selected ? 'hidden sm:flex' : 'flex')}>
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Inbox</h1>
            <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All conversations</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ConversationList
          conversations={filteredConversations}
          selectedId={selected?.id}
          onSelect={setSelected}
          loading={loading}
        />
      </div>

      {/* Chat area */}
      <div className={cn('flex-1 overflow-hidden', selected ? 'flex' : 'hidden sm:flex')}>
        {selected ? (
          <ChatWindow conversation={selected} onStatusChange={handleStatusChange} onBack={() => setSelected(null)} />
        ) : (
          <div className="h-full flex items-center justify-center text-center w-full">
            <div>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Choose from the list to start chatting</p>
              <Button variant="outline" size="sm" onClick={() => setShowNew(true)}>
                <Plus className="w-4 h-4 mr-2" />Start new conversation
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Channel selector — only shown when multiple active channels */}
            {channels.length > 1 && (
              <div className="space-y-2">
                <Label>Send from channel *</Label>
                <Select value={newForm.channel_id} onValueChange={(v) => setNewForm({ ...newForm, channel_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select WhatsApp channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.name} · {ch.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {channels.length === 0 && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                No active WhatsApp channels connected. Go to Settings → Channels first.
              </p>
            )}

            {/* Contact selector */}
            <div className="space-y-2">
              <Label>Contact *</Label>
              <Input
                placeholder="Search by name or phone…"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
              {contactSearch && (
                <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                  {filteredContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">No contacts found</p>
                  ) : filteredContacts.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setNewForm({ ...newForm, contact_id: c.id });
                        setContactSearch(c.name || c.phone || '');
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 hover:bg-muted/50 text-sm',
                        newForm.contact_id === c.id && 'bg-primary/5 font-medium',
                      )}
                    >
                      <span className="font-medium">{c.name || '—'}</span>
                      <span className="text-muted-foreground ml-2">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {newForm.contact_id && !contactSearch.includes('Search') && (
                <p className="text-xs text-green-700">
                  ✓ Contact selected
                </p>
              )}
            </div>

            {/* Optional first message */}
            <div className="space-y-2">
              <Label>First message <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Type a message to send…"
                rows={3}
                value={newForm.message}
                onChange={(e) => setNewForm({ ...newForm, message: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to just open the conversation without sending.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              onClick={handleNewConversation}
              disabled={creating || !newForm.channel_id || !newForm.contact_id || channels.length === 0}
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {newForm.message ? 'Send message' : 'Open conversation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
