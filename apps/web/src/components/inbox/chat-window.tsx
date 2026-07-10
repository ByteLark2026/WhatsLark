'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Send, MoreVertical, UserCheck, CheckCheck, Check, Clock, AlertCircle,
  StickyNote, ArrowLeft, Phone, WifiOff, Zap, Package, X, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, getInitials, formatRelativeTime } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { ConversationStatus, MessageDirection, MessageStatus, MessageType } from '@whatslark/shared';
import type { Conversation, Message } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';
import { ProductPicker, type PickedProduct } from '@/components/ecommerce/ProductPicker';

interface Props {
  conversation: Conversation;
  onStatusChange: (id: string, status: Conversation['status']) => void;
  onBack?: () => void;
}

const statusIcon: Record<MessageStatus, React.ReactNode> = {
  sent: <Check className="w-3 h-3 text-muted-foreground" />,
  delivered: <CheckCheck className="w-3 h-3 text-muted-foreground" />,
  read: <CheckCheck className="w-3 h-3 text-blue-500" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

export function ChatWindow({ conversation, onStatusChange, onBack }: Props) {
  const { toast } = useToast();
  const { user, company } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick replies panel
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{ id: string; shortcut: string; message: string }[]>([]);
  const [qrSearch, setQrSearch] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  // Product picker
  const [showProductPicker, setShowProductPicker] = useState(false);

  const contact = conversation.contact;
  const channel = (conversation as any).channel as { id: string; name: string; phone_number: string; is_active: boolean } | undefined;
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

  // Load quick replies when panel opens
  useEffect(() => {
    if (!showQuickReplies || !company?.id) return;
    setQrLoading(true);
    const supabase = createClient();
    supabase.from('quick_replies').select('id, shortcut, message').eq('company_id', company.id).order('shortcut')
      .then(({ data }) => { if (data) setQuickReplies(data); setQrLoading(false); });
  }, [showQuickReplies, company?.id]);

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
          toast({ title: 'Saved but not delivered', description: json.warning, variant: 'destructive' });
        }
        setMessages((prev) => [...prev, json.message as Message]);
        setText('');
      }
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const insertQuickReply = (msg: string) => {
    setText(msg);
    setShowQuickReplies(false);
    setQrSearch('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const insertProduct = (product: PickedProduct) => {
    const lines: string[] = [];
    lines.push(`🛍️ *${product.name}*`);
    if (product.price != null) lines.push(`💰 Price: ${product.price}`);
    if (product.sku) lines.push(`SKU: ${product.sku}`);
    if (product.product_url) lines.push(`\n🔗 ${product.product_url}`);
    setText((t) => (t ? t + '\n\n' : '') + lines.join('\n'));
    setShowProductPicker(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const updateStatus = async (status: Conversation['status']) => {
    const supabase = createClient();
    const { error } = await supabase.from('conversations').update({ status }).eq('id', conversation.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    onStatusChange(conversation.id, status);
    toast({ title: 'Conversation updated' });
  };

  const filteredQr = quickReplies.filter(
    (r) => !qrSearch || r.shortcut.includes(qrSearch) || r.message.toLowerCase().includes(qrSearch.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <Button variant="ghost" size="icon" className="sm:hidden -ml-2 flex-shrink-0" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarImage src={contact?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground truncate">{contact?.phone}</p>
              {channel && (
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0',
                  channel.is_active ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700',
                )}>
                  <Phone className="w-2.5 h-2.5" />{channel.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Messages */}
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
              <div className={cn(
                'max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl text-sm',
                isNoteMsg ? 'bg-yellow-50 border border-yellow-200 text-yellow-900'
                  : isOut ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-muted rounded-bl-sm',
              )}>
                {isNoteMsg && (
                  <div className="flex items-center gap-1 mb-1 text-yellow-600">
                    <StickyNote className="w-3 h-3" />
                    <span className="text-xs font-medium">Internal note</span>
                  </div>
                )}
                {msg.media_url && msg.type === 'image' ? (
                  <a href={`/api/media?id=${encodeURIComponent(msg.media_url)}&channel_id=${encodeURIComponent(conversation.channel_id)}`} target="_blank" rel="noopener noreferrer">
                    <img src={`/api/media?id=${encodeURIComponent(msg.media_url)}&channel_id=${encodeURIComponent(conversation.channel_id)}`}
                      alt={msg.content || 'Image'} className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90" loading="lazy" />
                    {msg.content && <p className="text-xs mt-1 opacity-80">{msg.content}</p>}
                  </a>
                ) : msg.media_url && msg.type === 'video' ? (
                  <video src={`/api/media?id=${encodeURIComponent(msg.media_url)}&channel_id=${encodeURIComponent(conversation.channel_id)}`}
                    controls className="max-w-[240px] rounded-lg" />
                ) : msg.media_url && (msg.type === 'document' || msg.type === 'audio') ? (
                  <a href={`/api/media?id=${encodeURIComponent(msg.media_url)}&channel_id=${encodeURIComponent(conversation.channel_id)}`}
                    target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline text-sm">
                    📎 {msg.content || (msg.type === 'audio' ? 'Voice message' : 'File')}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
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

      {/* Quick replies panel */}
      {showQuickReplies && (
        <div className="border-t bg-background">
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-medium">Quick replies</span>
            <div className="flex-1">
              <Input
                className="h-6 text-xs"
                placeholder="Search…"
                value={qrSearch}
                onChange={(e) => setQrSearch(e.target.value)}
                autoFocus
              />
            </div>
            <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => { setShowQuickReplies(false); setQrSearch(''); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {qrLoading ? (
              <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
            ) : filteredQr.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {quickReplies.length === 0 ? 'No quick replies yet — add some in Settings' : 'No matches'}
              </p>
            ) : filteredQr.map((r) => (
              <button key={r.id}
                onClick={() => insertQuickReply(r.message)}
                className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors border-b last:border-0">
                <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5 font-mono">/{r.shortcut}</Badge>
                <p className="text-xs text-muted-foreground truncate">{r.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compose area */}
      <div className="border-t p-3 space-y-2">
        {channel && !channel.is_active && !isNote && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-orange-50 border border-orange-200">
            <WifiOff className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="text-xs text-orange-700">
              Channel <strong>{channel.name}</strong> is paused — messages will not be delivered until reactivated.
            </span>
          </div>
        )}
        {isNote && (
          <div className="flex items-center gap-2 px-1">
            <StickyNote className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs text-yellow-700 font-medium">Writing internal note (not sent to customer)</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            {/* Toolbar */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm" type="button"
                className={cn('h-6 px-2 text-xs gap-1', showQuickReplies && 'bg-yellow-50 text-yellow-700')}
                onClick={() => { setShowQuickReplies((v) => !v); setShowProductPicker(false); }}>
                <Zap className="w-3 h-3" />Quick replies
              </Button>
              <Button
                variant="ghost" size="sm" type="button"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => { setShowProductPicker(true); setShowQuickReplies(false); }}>
                <Package className="w-3 h-3" />Product
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isNote ? 'Add an internal note…' : 'Type a message…'}
              className={cn('min-h-[44px] max-h-32 resize-none text-sm', isNote && 'bg-yellow-50 border-yellow-200')}
              onKeyDown={(e) => {
                // Type / to trigger quick replies
                if (e.key === '/' && !text) { e.preventDefault(); setShowQuickReplies(true); return; }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Button
              variant={isNote ? 'outline' : 'ghost'} size="icon"
              onClick={() => setIsNote(!isNote)}
              className={isNote ? 'border-yellow-300 text-yellow-700' : 'text-muted-foreground'}
              title="Toggle internal note">
              <StickyNote className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={sendMessage} disabled={sending || !text.trim()}>
              {sending ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <ProductPicker
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={insertProduct}
      />
    </div>
  );
}
