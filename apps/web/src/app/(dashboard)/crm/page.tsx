'use client';

import { useEffect, useState } from 'react';
import { Plus, Phone, Video, Mail, FileText, CheckSquare, MessageSquare, Clock, TrendingUp, Users, Activity, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatDate, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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

const GRADE_COLORS: Record<string, string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-orange-100 text-orange-700',
  cold: 'bg-blue-100 text-blue-700',
  dead: 'bg-gray-100 text-gray-600',
};

interface Activity {
  id: string;
  type: string;
  title: string;
  description?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  contacts?: { name?: string; phone?: string };
  leads?: { title?: string; stage?: string };
  assigned_user?: { full_name?: string };
}

export default function CrmPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcoming, setUpcoming] = useState<Activity[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ type: 'call', title: '', description: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [acts, up, fc, scored] = await Promise.allSettled([
      api.get<any>('/activities?limit=15'),
      api.get<Activity[]>('/activities/upcoming'),
      api.get<any>('/leads/forecast'),
      api.get<any>('/scoring/leads?grade=hot&limit=5'),
    ]);
    if (acts.status === 'fulfilled') setActivities(acts.value?.data || []);
    if (up.status === 'fulfilled') setUpcoming(up.value || []);
    if (fc.status === 'fulfilled') setForecast(fc.value);
    if (scored.status === 'fulfilled') setHotLeads(scored.value?.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addActivity = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/activities', form);
      toast({ title: 'Activity logged' });
      setAddOpen(false);
      setForm({ type: 'call', title: '', description: '', due_date: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const complete = async (id: string) => {
    await api.patch(`/activities/${id}/complete`);
    setUpcoming((prev) => prev.filter((a) => a.id !== id));
    toast({ title: 'Marked complete' });
  };

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div>
      <Header
        title="CRM"
        subtitle="Activities, pipeline & lead intelligence"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Log Activity
          </Button>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {/* KPI strip */}
        {forecast && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Pipeline', value: `${forecast.total_leads} leads`, sub: `${fmt(forecast.total_pipeline)} value`, icon: TrendingUp, color: 'text-blue-600' },
              { label: 'Forecast', value: fmt(forecast.weighted_forecast), sub: 'weighted revenue', icon: Activity, color: 'text-purple-600' },
              { label: 'Win Rate', value: `${forecast.win_rate}%`, sub: 'won / closed', icon: CheckSquare, color: 'text-green-600' },
              { label: 'Won This Month', value: fmt(forecast.won_this_month), sub: 'revenue closed', icon: Flame, color: 'text-orange-600' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <s.icon className={cn('w-4 h-4', s.color)} />
                  </div>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Recent Activity</h2>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push('/leads')}>
                View all leads →
              </Button>
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : activities.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
                No activities yet. Log a call, meeting, or note.
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] || Activity;
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className={cn('p-1.5 rounded-md mt-0.5', ACTIVITY_COLORS[a.type] || 'bg-gray-100')}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{a.title}</p>
                          {a.completed_at && <Badge variant="success" className="text-[10px] shrink-0">Done</Badge>}
                        </div>
                        <div className="flex gap-3 mt-0.5">
                          {a.contacts?.name && <span className="text-xs text-muted-foreground">{a.contacts.name}</span>}
                          {a.leads?.title && <span className="text-xs text-muted-foreground">· {a.leads.title}</span>}
                          <span className="text-xs text-muted-foreground ml-auto">{formatDate(a.created_at)}</span>
                        </div>
                        {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Upcoming tasks */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Upcoming</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No upcoming tasks</p>
                ) : (
                  upcoming.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-sm">
                      <Button variant="ghost" size="icon" className="h-5 w-5 mt-0.5 shrink-0" onClick={() => complete(a.id)}>
                        <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.due_date ? formatDate(a.due_date) : ''} {a.contacts?.name ? `· ${a.contacts.name}` : ''}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Hot leads */}
            {hotLeads.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-red-500" />Hot Leads</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {hotLeads.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded p-1 -mx-1" onClick={() => router.push('/leads')}>
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">
                        {l.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{l.title}</p>
                        <p className="text-xs text-muted-foreground">{l.contacts?.name || ''} · {l.deal_value ? `${l.currency || ''} ${l.deal_value.toLocaleString()}` : 'No value'}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Add Activity Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['call', 'meeting', 'email', 'note', 'task', 'whatsapp'].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Called about proposal…" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="h-20" />
            </div>
            <div className="space-y-1.5">
              <Label>Due date (for tasks)</Label>
              <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addActivity} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Log'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
