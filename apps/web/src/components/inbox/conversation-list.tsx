'use client';

import { cn, getInitials, formatRelativeTime } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Conversation } from '@whatslark/shared';

const CHANNEL_COLORS = [
  { bg: '#075E54', text: '#fff' },
  { bg: '#1565C0', text: '#fff' },
  { bg: '#6A1B9A', text: '#fff' },
  { bg: '#D84315', text: '#fff' },
  { bg: '#2E7D32', text: '#fff' },
  { bg: '#00695C', text: '#fff' },
  { bg: '#4527A0', text: '#fff' },
  { bg: '#AD1457', text: '#fff' },
];

function channelColor(channelId: string) {
  let hash = 0;
  for (let i = 0; i < channelId.length; i++) hash = (hash * 31 + channelId.charCodeAt(i)) >>> 0;
  return CHANNEL_COLORS[hash % CHANNEL_COLORS.length];
}

interface Props {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conv: Conversation) => void;
  loading?: boolean;
}

const statusBadge = {
  open:    { label: 'Open',    cls: 'bg-green-100 text-green-800' },
  pending: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-800' },
  closed:  { label: 'Closed',  cls: 'bg-gray-100 text-gray-600' },
};

export function ConversationList({ conversations, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-1 p-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 px-4">
        No conversations
      </p>
    );
  }

  // Group by channel
  const grouped: { channelId: string; channelName: string; color: { bg: string; text: string } | null; convs: Conversation[] }[] = [];
  const seen = new Map<string, number>();
  for (const conv of conversations) {
    const ch = (conv as any).channel as { id: string; name: string; is_active: boolean } | undefined;
    const key = ch?.id ?? '__none__';
    if (!seen.has(key)) {
      seen.set(key, grouped.length);
      grouped.push({
        channelId: key,
        channelName: ch?.name ?? 'Unknown channel',
        color: ch?.id ? channelColor(ch.id) : null,
        convs: [],
      });
    }
    grouped[seen.get(key)!].convs.push(conv);
  }

  return (
    <div className="overflow-y-auto flex-1">
      {grouped.map((group) => (
        <div key={group.channelId}>
          {/* Channel header */}
          <div
            className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold border-b"
            style={group.color
              ? { backgroundColor: group.color.bg, color: group.color.text }
              : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
            {group.channelName}
            <span className="ml-auto opacity-70">{group.convs.length}</span>
          </div>

          {group.convs.map((conv) => {
            const contact = conv.contact;
            const name = contact?.name || contact?.phone || 'Unknown';
            const badge = statusBadge[conv.status] ?? statusBadge.open;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50',
                  selectedId === conv.id && 'bg-primary/5 border-l-2 border-l-primary',
                )}
              >
                <Avatar className="w-10 h-10 flex-shrink-0 mt-0.5">
                  <AvatarImage src={contact?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium truncate">{name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {conv.unread_count > 0 && (
                        <span
                          className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-medium"
                          style={{ backgroundColor: group.color?.bg ?? '#075E54' }}
                        >
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message_preview || 'No messages yet'}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', badge.cls)}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
