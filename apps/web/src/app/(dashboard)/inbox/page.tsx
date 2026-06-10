'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConversationList } from '@/components/inbox/conversation-list';
import { ChatWindow } from '@/components/inbox/chat-window';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { ConversationStatus } from '@whatslark/shared';
import type { Conversation } from '@whatslark/shared';

export default function InboxPage() {
  const { company } = useAuthStore();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get('conversation');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConversationStatus | 'all'>(ConversationStatus.OPEN);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('conversations')
      .select('*, contact:contacts(id, name, phone, avatar_url, email)')
      .eq('company_id', company.id)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (status !== 'all') query = query.eq('status', status);

    (async () => {
      const { data, error } = await query;
      if (!error && data) setConversations(data as unknown as Conversation[]);
      setLoading(false);
    })();
  }, [company?.id, status]);

  useEffect(() => {
    if (!conversationParam || !company?.id) return;
    const fromList = conversations.find((c) => c.id === conversationParam);
    if (fromList) {
      setSelected(fromList);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, contact:contacts(id, name, phone, avatar_url, email)')
        .eq('id', conversationParam)
        .eq('company_id', company.id)
        .maybeSingle();
      if (!error && data) setSelected(data as unknown as Conversation);
    })();
  }, [conversationParam, conversations, company?.id]);

  const filtered = conversations.filter((c) => {
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

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-80 flex flex-col border-r bg-background">
        <div className="p-4 border-b space-y-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
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
          conversations={filtered}
          selectedId={selected?.id}
          onSelect={setSelected}
          loading={loading}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ChatWindow conversation={selected} onStatusChange={handleStatusChange} />
        ) : (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm text-muted-foreground mt-1">Choose from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
