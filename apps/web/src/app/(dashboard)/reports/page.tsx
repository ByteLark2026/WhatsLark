'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Send, CheckCheck, Eye, Reply, XCircle, Search, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { CampaignStatus } from '@whatslark/shared';
import type { Campaign } from '@whatslark/shared';
import { formatDate } from '@/lib/utils';

const statusVariant: Record<CampaignStatus, any> = {
  draft: 'outline',
  scheduled: 'info',
  running: 'warning',
  completed: 'success',
  paused: 'secondary',
  failed: 'destructive',
};

const FUNNEL_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444'];

function CampaignFunnel({ campaign }: { campaign: Campaign }) {
  const total = campaign.total_recipients || 0;
  const sent = campaign.sent_count || 0;
  const delivered = (campaign as any).delivered_count || 0;
  const read = (campaign as any).read_count || 0;
  const replied = (campaign as any).replied_count || 0;
  const failed = (campaign as any).failed_count || 0;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const bars = [
    { name: 'Sent', value: sent, pct: pct(sent), color: FUNNEL_COLORS[0] },
    { name: 'Delivered', value: delivered, pct: pct(delivered), color: FUNNEL_COLORS[1] },
    { name: 'Read', value: read, pct: pct(read), color: FUNNEL_COLORS[2] },
    { name: 'Replied', value: replied, pct: pct(replied), color: FUNNEL_COLORS[3] },
    { name: 'Failed', value: failed, pct: pct(failed), color: FUNNEL_COLORS[4] },
  ];

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{(campaign as any).name || `Campaign`}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(campaign.created_at)} · {total.toLocaleString()} recipients</p>
          </div>
          <Badge variant={statusVariant[campaign.status]} className="shrink-0">{campaign.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No recipients yet</p>
        ) : (
          <>
            {/* Funnel bars */}
            <div className="space-y-2 mb-4">
              {bars.map((b) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14 text-right shrink-0">{b.name}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                    />
                  </div>
                  <span className="text-xs font-medium w-20 shrink-0">{b.value.toLocaleString()} <span className="text-muted-foreground">({b.pct}%)</span></span>
                </div>
              ))}
            </div>
            {/* Recharts bar */}
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={bars} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={28}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, total]} />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(v: any) => [`${v} (${pct(v)}%)`, '']}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {bars.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const { company } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, scheduled_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      setCampaigns((data as any) || []);
      setLoading(false);
    })();
  }, [company?.id]);

  const visible = campaigns.filter((c) =>
    !search || (c as any).name?.toLowerCase().includes(search.toLowerCase()) || c.status.includes(search),
  );

  const completedCampaigns = campaigns.filter((c) => c.status === 'completed');
  const totalSent = completedCampaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
  const totalDelivered = completedCampaigns.reduce((s, c) => s + ((c as any).delivered_count || 0), 0);
  const totalRead = completedCampaigns.reduce((s, c) => s + ((c as any).read_count || 0), 0);
  const avgDelivery = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const avgRead = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  return (
    <div>
      <Header title="Campaign Reports" subtitle="Per-campaign delivery funnel and performance metrics" />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Campaigns', value: campaigns.length, icon: BarChart2 },
            { label: 'Avg Delivery Rate', value: `${avgDelivery}%`, icon: CheckCheck },
            { label: 'Avg Read Rate', value: `${avgRead}%`, icon: Eye },
            { label: 'Messages Sent', value: totalSent.toLocaleString(), icon: Send },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
                <p className="text-2xl font-bold">{loading ? '—' : s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Campaign funnels */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart2 className="w-10 h-10 mx-auto mb-3" />
            <p>{campaigns.length === 0 ? 'No campaigns yet' : 'No matches'}</p>
          </div>
        ) : (
          <div>
            {visible.map((c) => <CampaignFunnel key={c.id} campaign={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
