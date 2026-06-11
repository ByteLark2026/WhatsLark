'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart2, TrendingUp, MessageSquare, CheckCheck, Eye, Reply, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { format, subDays, parseISO, startOfDay } from 'date-fns';

type Range = '7d' | '30d' | '3m';

interface DayData {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
}

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '3m': 90 };

export default function AnalyticsPage() {
  const { company } = useAuthStore();
  const [range, setRange] = useState<Range>('30d');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [contactCount, setContactCount] = useState(0);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    const days = RANGE_DAYS[range];
    const since = subDays(new Date(), days).toISOString();

    setLoading(true);
    (async () => {
      const [msgRes, campRes, ctRes] = await Promise.all([
        supabase
          .from('messages')
          .select('created_at, status, direction')
          .eq('company_id', company.id)
          .gte('created_at', since),
        supabase
          .from('campaigns')
          .select('status, total_recipients, sent_count, delivered_count, read_count, failed_count, replied_count')
          .eq('company_id', company.id),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id),
      ]);
      setMessages(msgRes.data || []);
      setCampaigns(campRes.data || []);
      setContactCount(ctRes.count || 0);
      setLoading(false);
    })();
  }, [company?.id, range]);

  const { chartData, overview } = useMemo(() => {
    const days = RANGE_DAYS[range];
    const buckets: Record<string, DayData> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM d');
      buckets[d] = { date: d, sent: 0, delivered: 0, read: 0, replied: 0 };
    }

    for (const msg of messages) {
      const day = format(parseISO(msg.created_at), 'MMM d');
      if (!buckets[day]) continue;
      if (msg.direction === 'outbound') {
        buckets[day].sent++;
        if (msg.status === 'delivered' || msg.status === 'read') buckets[day].delivered++;
        if (msg.status === 'read') buckets[day].read++;
      } else {
        buckets[day].replied++;
      }
    }

    const chartData = Object.values(buckets);
    const total = messages.filter(m => m.direction === 'outbound').length;
    const delivered = messages.filter(m => m.direction === 'outbound' && (m.status === 'delivered' || m.status === 'read')).length;
    const read = messages.filter(m => m.direction === 'outbound' && m.status === 'read').length;
    const replied = messages.filter(m => m.direction === 'inbound').length;
    const failed = messages.filter(m => m.direction === 'outbound' && m.status === 'failed').length;

    return {
      chartData,
      overview: {
        total,
        deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0',
        readRate: total > 0 ? ((read / total) * 100).toFixed(1) : '0.0',
        replyRate: total > 0 ? ((replied / total) * 100).toFixed(1) : '0.0',
        failureRate: total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0',
      },
    };
  }, [messages, range]);

  const activeCampaigns = campaigns.filter(c => c.status === 'running' || c.status === 'scheduled').length;
  const totalRecipients = campaigns.reduce((s, c) => s + (c.total_recipients || 0), 0);

  return (
    <div>
      <Header
        title="Analytics & Reports"
        subtitle="Track your WhatsApp business performance with real-time data"
        actions={
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Time range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Time Range:</span>
          {(['7d', '30d', '3m'] as Range[]).map((r) => (
            <Button
              key={r}
              variant={range === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange(r)}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '3 Months'}
            </Button>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Messages', value: overview.total, sub: `Last ${RANGE_DAYS[range]} days`, icon: MessageSquare, color: 'text-blue-600' },
                { label: 'Delivery Rate', value: `${overview.deliveryRate}%`, sub: '', icon: CheckCheck, color: 'text-green-600' },
                { label: 'Read Rate', value: `${overview.readRate}%`, sub: '', icon: Eye, color: 'text-orange-500' },
                { label: 'Reply Rate', value: `${overview.replyRate}%`, sub: '', icon: Reply, color: 'text-purple-600' },
                { label: 'Failure Rate', value: `${overview.failureRate}%`, sub: '', icon: XCircle, color: 'text-destructive' },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{loading ? '—' : s.value}</p>
                    {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
                    {!s.sub && (
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.color.replace('text-', 'bg-')}`}
                          style={{ width: `${Math.min(parseFloat(s.value as string) || 0, 100)}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Message Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-64 bg-muted animate-pulse rounded" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Sent" />
                        <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Delivered" />
                        <Line type="monotone" dataKey="read" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Read" />
                        <Line type="monotone" dataKey="replied" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="Replied" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Active Campaigns', value: activeCampaigns },
                    { label: 'Total Campaigns', value: campaigns.length },
                    { label: 'Unique Contacts', value: contactCount.toLocaleString() },
                    { label: 'Total Recipients', value: totalRecipients.toLocaleString() },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{s.label}</span>
                      <span className="text-sm font-semibold">{loading ? '—' : s.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Messages Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-72 bg-muted animate-pulse rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="sent-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="delivered-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#sent-grad)" strokeWidth={2} name="Sent" />
                      <Area type="monotone" dataKey="delivered" stroke="#22c55e" fill="url(#delivered-grad)" strokeWidth={2} name="Delivered" />
                      <Line type="monotone" dataKey="read" stroke="#f97316" strokeWidth={2} dot={false} name="Read" />
                      <Line type="monotone" dataKey="replied" stroke="#a855f7" strokeWidth={2} dot={false} name="Replied" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Campaigns', value: campaigns.length },
                { label: 'Active', value: activeCampaigns },
                { label: 'Total Recipients', value: totalRecipients.toLocaleString() },
                { label: 'Avg Delivery Rate', value: (() => {
                  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
                  const totalDel = campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0);
                  return totalSent > 0 ? `${Math.round(totalDel / totalSent * 100)}%` : '0%';
                })() },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{loading ? '—' : s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {campaigns.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BarChart2 className="w-10 h-10 mx-auto mb-3" />
                <p>No campaign data yet</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <div className="divide-y min-w-[480px]">
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                      <div className="col-span-2">Campaign</div>
                      <div>Recipients</div>
                      <div>Delivered</div>
                      <div>Read</div>
                    </div>
                    {campaigns.map((c, i) => (
                      <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm">
                        <div className="col-span-2 font-medium capitalize">{c.status}</div>
                        <div>{c.total_recipients || 0}</div>
                        <div className="text-green-700">{c.sent_count > 0 ? `${Math.round(c.delivered_count / c.sent_count * 100)}%` : '—'}</div>
                        <div className="text-blue-700">{c.delivered_count > 0 ? `${Math.round(c.read_count / c.delivered_count * 100)}%` : '—'}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
