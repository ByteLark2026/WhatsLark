'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useChannelStore } from '@/store/channel';
import { cn } from '@/lib/utils';

const CHANNEL_COLORS = [
  '#075E54', '#1565C0', '#6A1B9A', '#D84315',
  '#2E7D32', '#00695C', '#4527A0', '#AD1457',
];

function channelColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CHANNEL_COLORS[h % CHANNEL_COLORS.length];
}

export function ChannelSwitcher() {
  const { company } = useAuthStore();
  const { channels, selectedChannelId, setChannels, setSelectedChannelId } = useChannelStore();

  useEffect(() => {
    if (!company?.id) return;
    const supabase = createClient();
    supabase
      .from('whatsapp_channels')
      .select('id, name, phone_number')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => { if (data) setChannels(data); });
  }, [company?.id]);

  if (channels.length < 2) return null;

  return (
    <div className="px-3 py-2 border-b border-sidebar-border space-y-1">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
        Channel
      </p>
      <div className="space-y-0.5">
        <button
          onClick={() => setSelectedChannelId(null)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
            selectedChannelId === null
              ? 'bg-sidebar-accent text-white'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
          )}
        >
          <span className="w-2 h-2 rounded-full bg-sidebar-foreground/40 flex-shrink-0" />
          All channels
        </button>
        {channels.map((ch) => {
          const color = channelColor(ch.id);
          const active = selectedChannelId === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setSelectedChannelId(active ? null : ch.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
              )}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{ch.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
