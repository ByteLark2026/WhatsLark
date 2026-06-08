'use client';

import { cn, getInitials, formatRelativeTime, truncate } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Conversation } from '@whatslark/shared';

interface Props {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conv: Conversation) => void;
  loading?: boolean;
}

const statusBadge = {
  open: { label: 'Open', class: 'bg-green-100 text-green-800' },
  pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-800' },
  closed: { label: 'Closed', class: 'bg-gray-100 text-gray-600' },
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
    return <p className="text-sm text-muted-foreground text-center py-8">No conversations</p>;
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conv) => {
        const contact = conv.contact;
        const name = contact?.name || contact?.phone || 'Unknown';
        const badge = statusBadge[conv.status];
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
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {conv.last_message_preview || 'No messages yet'}
                </p>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', badge.class)}>
                  {badge.label}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
