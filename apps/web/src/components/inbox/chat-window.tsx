'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, MoreVertical, UserCheck, CheckCheck, Check, Clock, AlertCircle, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, getInitials, formatRelativeTime } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { ConversationStatus, MessageDirection, MessageStatus, MessageType } from '@whatslark/shared';
import type { Conversation, Message } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

interface Props {
  conversation: Conversation;
  onStatusChange: (id: string, status: Conversation['status']) => void;
}

const statusIcon: Record<MessageStatus, React.ReactNode> = {
  sent: <Check className="w-3 h-3 text-muted-foreground" />,
  delivered: <CheckCheck className="w-3 h-3 text-muted-foreground" />,
  read: <CheckCheck className="w-3 h-3 text-blue-500" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

export function ChatWindow({ conversation, onStatusChange }: Props) {
  const { toast } = useToast();
  const { user, company } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const contact = conversation.contact;
  const name = contact?.name || contact?.phone || 'Unknown';

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (!error && data) setMessages(data as unknown as Message[]);
      setLoading(false);
    })();
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !user?.id || !company?.id) return;
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          company_id: company.id,
          sender_id: user.id,
          message: text.trim(),
          is_note: isNote,
        }),
      });
      const json = await res.json();

      if (!res.ok && res.status !== 207) {
        toast({ title: 'Failed to send', description: json.error, variant: 'destructive' });
      } else {
        if (json.warning) {
          // Message saved but delivery failed (e.g. no channel connected yet)
          toast({
            title: 'Saved but not delivered',
            description: json.warning,
            variant: 'destructive',
          });
        }
        setMessages((prev) => [...prev, json.message as Message]);
        setText('');
      }
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const updateStatus = async (status: Conversation['status']) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('conversations')
      .update({ status })
      .eq('id', conversation.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    onStatusChange(conversation.id, status);
    toast({ title: 'Conversation updated' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarImage src={contact?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{contact?.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={conversation.status === 'open' ? 'success' : conversation.status === 'pending' ? 'warning' : 'secondary'}>
            {conversation.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {conversation.status !== ConversationStatus.OPEN && (
                <DropdownMenuItem onClick={() => updateStatus(ConversationStatus.OPEN)}>
                  <UserCheck className="w-4 h-4 mr-2" />Reopen
                </DropdownMenuItem>
              )}
              {conversation.status !== ConversationStatus.PENDING && (
                <DropdownMenuItem onClick={() => updateStatus(ConversationStatus.PENDING)}>
                  <Clock className="w-4 h-4 mr-2" />Mark pending
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {conversation.status !== ConversationStatus.CLOSED && (
                <DropdownMenuItem onClick={() => updateStatus(ConversationStatus.CLOSED)} className="text-destructive focus:text-destructive">
                  Close conversation
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <div className={cn('h-10 bg-muted animate-pulse rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-36')} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
        ) : messages.map((msg) => {
          const isOut = msg.direction === 'outbound';
          const isNoteMsg = msg.is_note;
          return (
            <div key={msg.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[70%] px-3.5 py-2 rounded-2xl text-sm',
                  isNoteMsg
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-900'
                    : isOut
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-muted rounded-bl-sm',
                )}
              >
                {isNoteMsg && (
                  <div className="flex items-center gap-1 mb-1 text-yellow-600">
                    <StickyNote className="w-3 h-3" />
                    <span className="text-xs font-medium">Internal note</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div className={cn('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
                  <span className={cn('text-[10px]', isOut ? 'text-white/70' : 'text-muted-foreground')}>
                    {formatRelativeTime(msg.created_at)}
                  </span>
                  {isOut && !isNoteMsg && statusIcon[msg.status]}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        {isNote && (
          <div className="flex items-center gap-2 px-1">
            <StickyNote className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs text-yellow-700 font-medium">Writing internal note (not sent to customer)</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isNote ? 'Add an internal note…' : 'Type a message…'}
            className={cn('min-h-[44px] max-h-32 resize-none text-sm', isNote && 'bg-yellow-50 border-yellow-200')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <div className="flex flex-col gap-1">
            <Button
              variant={isNote ? 'outline' : 'ghost'}
              size="icon"
              onClick={() => setIsNote(!isNote)}
              className={isNote ? 'border-yellow-300 text-yellow-700' : 'text-muted-foreground'}
              title="Toggle internal note"
            >
              <StickyNote className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={sendMessage} disabled={sending || !text.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
