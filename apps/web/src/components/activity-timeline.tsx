'use client';

import { useEffect, useState } from 'react';
import { Phone, Video, Mail, FileText, CheckSquare, MessageSquare, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone, meeting: Video, email: Mail,
  note: FileText, task: CheckSquare, whatsapp: MessageSquare,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  email: 'bg-orange-100 text-orange-700',
  note: 'bg-gray-100 text-gray-700',
  task: 'bg-green-100 text-green-700',
  whatsapp: 'bg-emerald-100 text-emerald-700',
};

interface ActivityRow {
  kind: 'activity';
  id: string;
  type: string;
  title: string;
  description?: string;
  completed_at?: string;
  created_at: string;
}

interface CallRow {
  kind: 'call';
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  handled_by?: string;
  duration_seconds?: number;
  recording_url?: string;
  transcript?: string;
  from_number: string;
  to_number: string;
  users?: { full_name?: string };
  created_at: string;
}

type TimelineItem = ActivityRow | CallRow;

function formatDuration(sec?: number): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ActivityTimeline({ contactId, leadId }: { contactId?: string; leadId?: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId && !leadId) return;
    const params = contactId ? `contact_id=${contactId}` : `lead_id=${leadId}`;

    (async () => {
      try {
        const [activitiesRes, callsRes] = await Promise.all([
          api.get<{ data: any[] } | any[]>(`/activities?${params}`).catch(() => []),
          api.get<{ data: any[] }>(`/voice/calls?${params}`).catch(() => ({ data: [] })),
        ]);
        const activities: any[] = Array.isArray(activitiesRes) ? activitiesRes : activitiesRes?.data || [];
        const calls: any[] = (callsRes as any)?.data || [];

        const activityItems: ActivityRow[] = activities
          .filter((a) => a.type !== 'call') // calls come from /voice/calls instead — richer data, no duplication
          .map((a) => ({ kind: 'activity', ...a }));
        const callItems: CallRow[] = calls.map((c) => ({ kind: 'call', ...c }));

        setItems([...activityItems, ...callItems].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
      } finally {
        setLoading(false);
      }
    })();
  }, [contactId, leadId]);

  if (loading) {
    return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.kind === 'call') {
          const isExpanded = expandedCall === item.id;
          const label = item.direction === 'inbound' ? 'Inbound call' : 'Outbound call';
          const handledBy = item.handled_by === 'ai' ? 'AI agent' : item.handled_by === 'voicemail' ? 'Voicemail' : item.users?.full_name;
          return (
            <div key={item.id} className="border rounded-lg hover:bg-muted/30 transition-colors">
              <button
                className="w-full flex items-start gap-3 p-3 text-left"
                onClick={() => setExpandedCall(isExpanded ? null : item.id)}
              >
                <div className={cn('p-1.5 rounded-md mt-0.5', ACTIVITY_COLORS.call)}>
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {label}{handledBy && <span className="text-muted-foreground font-normal"> · {handledBy}</span>}
                    </p>
                    <Badge variant={item.status === 'completed' ? 'success' : 'secondary'} className="text-[10px] shrink-0">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {item.direction === 'inbound' ? item.from_number : item.to_number}
                    </span>
                    {item.duration_seconds ? <span className="text-xs text-muted-foreground">· {formatDuration(item.duration_seconds)}</span> : null}
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(item.created_at)}</span>
                  </div>
                  {item.transcript && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.transcript}</p>
                  )}
                </div>
                {(item.recording_url || item.transcript) && (isExpanded ? <ChevronUp className="w-4 h-4 mt-1 shrink-0" /> : <ChevronDown className="w-4 h-4 mt-1 shrink-0" />)}
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pl-12 space-y-2">
                  {item.recording_url && <audio src={item.recording_url} controls className="w-full h-9" />}
                  {item.transcript && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.transcript}</p>}
                </div>
              )}
            </div>
          );
        }

        const Icon = ACTIVITY_ICONS[item.type] || Activity;
        return (
          <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
            <div className={cn('p-1.5 rounded-md mt-0.5', ACTIVITY_COLORS[item.type] || 'bg-gray-100')}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                {item.completed_at && <Badge variant="success" className="text-[10px] shrink-0">Done</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
