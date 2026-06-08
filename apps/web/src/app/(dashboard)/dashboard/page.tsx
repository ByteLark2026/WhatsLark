'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Users, Megaphone, TrendingUp, ArrowUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import type { DashboardStats, LeadStage } from '@whatslark/shared';

const STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: 'New Lead',
  qualified: 'Qualified',
  quotation_sent: 'Quotation Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const STAGE_COLORS: Record<LeadStage, string> = {
  new_lead: 'bg-blue-100 text-blue-800',
  qualified: 'bg-purple-100 text-purple-800',
  quotation_sent: 'bg-yellow-100 text-yellow-800',
  negotiation: 'bg-orange-100 text-orange-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardStats>('/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Contacts', value: stats?.total_contacts ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Conversations', value: stats?.open_conversations ?? 0, icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Messages Today', value: stats?.messages_today ?? 0, icon: ArrowUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active Campaigns', value: stats?.active_campaigns ?? 0, icon: Megaphone, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div>
      <Header title="Dashboard" subtitle="Your workspace at a glance" />
      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">
                      {loading ? <span className="animate-pulse">—</span> : s.value.toLocaleString()}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-6 h-6 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads by stage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Leads by Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : stats?.leads_by_stage ? (
                <div className="space-y-3">
                  {(Object.entries(stats.leads_by_stage) as [LeadStage, number][]).map(([stage, count]) => (
                    <div key={stage} className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_COLORS[stage]}`}>
                        {STAGE_LABELS[stage]}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, (count / Math.max(...Object.values(stats.leads_by_stage))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No leads yet</p>
              )}
            </CardContent>
          </Card>

          {/* Agent performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" /> Agent Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : stats?.agent_performance?.length ? (
                <div className="space-y-3">
                  {stats.agent_performance.map((agent) => (
                    <div key={agent.agent_id} className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(agent.agent_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.agent_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.open_conversations} open · {agent.closed_today} closed today
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {agent.avg_response_time_minutes}m avg
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No agent data yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
