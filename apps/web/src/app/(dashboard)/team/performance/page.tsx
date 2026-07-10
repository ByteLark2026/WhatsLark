'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Users, TrendingUp, DollarSign, Award, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

type Range = '7d' | '30d' | '90d';

interface Agent {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  avatar_url?: string;
  messages_sent: number;
  conversations_opened: number;
  conversations_closed: number;
  leads_created: number;
  deals_won: number;
  revenue: number;
}

export default function TeamPerformancePage() {
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState<Range>('7d');
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'messages_sent' | 'conversations_closed' | 'leads_created' | 'revenue'>('messages_sent');

  const load = async (r: Range) => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/dashboard/performance?range=${r}`);
      setData(res);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(range); }, [range]);

  const agents: Agent[] = data?.agents || [];
  const totals = data?.totals || {};

  const metricLabels: Record<string, string> = {
    messages_sent: 'Messages Sent',
    conversations_closed: 'Conversations Closed',
    leads_created: 'Leads Created',
    revenue: 'Revenue',
  };

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

  return (
    <div>
      <Header
        title="Team Performance"
        subtitle="Agent activity and productivity metrics"
        actions={
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as Range[]).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRange(r)}
              >
                {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
              </Button>
            ))}
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Totals strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Messages', value: totals.messages_sent || 0, icon: MessageSquare },
            { label: 'Convos opened', value: totals.conversations_opened || 0, icon: Users },
            { label: 'Convos closed', value: totals.conversations_closed || 0, icon: BarChart2 },
            { label: 'Leads', value: totals.leads_created || 0, icon: TrendingUp },
            { label: 'Deals won', value: totals.deals_won || 0, icon: Award },
            { label: 'Revenue', value: fmt(totals.revenue || 0), icon: DollarSign },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <s.icon className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Chart */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Agent Comparison</CardTitle>
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(metricLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setMetric(key as any)}
                        className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors', metric === key ? 'bg-primary text-white border-primary' : 'text-muted-foreground hover:bg-muted')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-48 bg-muted animate-pulse rounded-lg" />
                ) : agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">No agent data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={agents} barSize={24}>
                      <XAxis dataKey="agent_name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => metric === 'revenue' ? fmt(v) : String(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                      <Tooltip formatter={(v: number) => [metric === 'revenue' ? fmt(v) : v, metricLabels[metric]]} labelFormatter={(l) => l} />
                      <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                        {agents.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Leaderboard</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}</div>
                ) : agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  <div className="space-y-3">
                    {agents.map((agent, i) => (
                      <div key={agent.agent_id} className="flex items-center gap-3">
                        <span className={cn('w-5 text-center text-sm font-bold', i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-muted-foreground')}>
                          {i + 1}
                        </span>
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={agent.avatar_url} />
                          <AvatarFallback className="text-xs bg-primary text-white">{getInitials(agent.agent_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{agent.agent_name}</p>
                          <p className="text-xs text-muted-foreground">{agent.messages_sent} msgs · {agent.conversations_closed} closed</p>
                        </div>
                        {agent.deals_won > 0 && (
                          <Badge variant="success" className="text-[10px] shrink-0">{agent.deals_won} won</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full table */}
        {agents.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Detailed Breakdown</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3">Agent</th>
                    <th className="text-right py-2 px-3">Messages</th>
                    <th className="text-right py-2 px-3">Convos opened</th>
                    <th className="text-right py-2 px-3">Convos closed</th>
                    <th className="text-right py-2 px-3">Leads</th>
                    <th className="text-right py-2 px-3">Deals won</th>
                    <th className="text-right py-2 px-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agents.map((agent) => (
                    <tr key={agent.agent_id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={agent.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-primary text-white">{getInitials(agent.agent_name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{agent.agent_name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-3">{agent.messages_sent}</td>
                      <td className="text-right py-2.5 px-3">{agent.conversations_opened}</td>
                      <td className="text-right py-2.5 px-3">{agent.conversations_closed}</td>
                      <td className="text-right py-2.5 px-3">{agent.leads_created}</td>
                      <td className="text-right py-2.5 px-3">{agent.deals_won}</td>
                      <td className="text-right py-2.5 px-3 font-medium">{agent.revenue > 0 ? fmt(agent.revenue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
