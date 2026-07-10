'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { CampaignStatus } from '@whatslark/shared';
import type { Campaign } from '@whatslark/shared';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

const statusVariant: Record<CampaignStatus, any> = {
  draft: 'outline',
  scheduled: 'info',
  running: 'warning',
  completed: 'success',
  paused: 'secondary',
  failed: 'destructive',
};

const statusColor: Record<CampaignStatus, string> = {
  draft: 'bg-muted-foreground/20',
  scheduled: 'bg-blue-500',
  running: 'bg-yellow-500',
  completed: 'bg-green-500',
  paused: 'bg-gray-400',
  failed: 'bg-red-500',
};

export default function SchedulePage() {
  const { company } = useAuthStore();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, scheduled_at, total_recipients, sent_count')
        .eq('company_id', company.id)
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true });
      setCampaigns((data as any) || []);
      setLoading(false);
    })();
  }, [company?.id]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const allDays = eachDayOfInterval({ start, end });
    // Pad to start week on Sunday
    const firstDow = start.getDay();
    const padded = Array(firstDow).fill(null).concat(allDays);
    return padded;
  }, [month]);

  const campaignsByDay = useMemo(() => {
    const map: Record<string, Campaign[]> = {};
    for (const c of campaigns) {
      if (!(c as any).scheduled_at) continue;
      const key = format(new Date((c as any).scheduled_at), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [campaigns]);

  const selectedCampaigns = selectedDay
    ? (campaignsByDay[format(selectedDay, 'yyyy-MM-dd')] || [])
    : [];

  return (
    <div>
      <Header
        title="Campaign Schedule"
        subtitle="Calendar view of all scheduled campaigns"
        actions={
          <Button size="sm" onClick={() => router.push('/campaigns/new')}>
            <Plus className="w-4 h-4 mr-1.5" />New Campaign
          </Button>
        }
      />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-base font-semibold">{format(month, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              {/* Days grid */}
              {loading ? (
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(35)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} />;
                    const key = format(day, 'yyyy-MM-dd');
                    const dayCampaigns = campaignsByDay[key] || [];
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const today = isToday(day);
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDay(isSameDay(day, selectedDay!) ? null : day)}
                        className={cn(
                          'relative p-1 rounded-lg text-left transition-colors min-h-[52px]',
                          !isSameMonth(day, month) && 'opacity-40',
                          isSelected ? 'bg-primary text-white' : today ? 'bg-primary/10' : 'hover:bg-muted',
                        )}
                      >
                        <span className={cn(
                          'text-xs font-medium block mb-1',
                          isSelected ? 'text-white' : today ? 'text-primary' : '',
                        )}>
                          {format(day, 'd')}
                        </span>
                        <div className="flex flex-wrap gap-0.5">
                          {dayCampaigns.slice(0, 3).map((c) => (
                            <div
                              key={c.id}
                              className={cn('w-1.5 h-1.5 rounded-full', statusColor[c.status])}
                              title={(c as any).name}
                            />
                          ))}
                          {dayCampaigns.length > 3 && (
                            <span className={cn('text-[9px]', isSelected ? 'text-white/70' : 'text-muted-foreground')}>+{dayCampaigns.length - 3}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side panel */}
          <div className="space-y-3">
            {selectedDay ? (
              <>
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(selectedDay, 'EEEE, MMMM d')}
                </h3>
                {selectedCampaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm">No campaigns scheduled</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/campaigns/new')}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Schedule one
                    </Button>
                  </div>
                ) : selectedCampaigns.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', statusColor[c.status])} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{(c as any).name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((c as any).scheduled_at), 'h:mm a')}
                          </p>
                        </div>
                        <Badge variant={statusVariant[c.status]} className="shrink-0 text-[10px]">{c.status}</Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.total_recipients || 0}</span>
                        <span className="flex items-center gap-1"><Send className="w-3 h-3" />{c.sent_count || 0} sent</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Click a day to see campaigns</p>
              </div>
            )}

            {/* Upcoming list */}
            <div className="border-t pt-3 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upcoming</h3>
              {campaigns.filter((c) => c.status === 'scheduled').slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', statusColor[c.status])} />
                  <span className="truncate flex-1">{(c as any).name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date((c as any).scheduled_at), 'MMM d')}
                  </span>
                </div>
              ))}
              {campaigns.filter((c) => c.status === 'scheduled').length === 0 && (
                <p className="text-xs text-muted-foreground">No scheduled campaigns</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
