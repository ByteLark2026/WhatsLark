'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Users, Megaphone, TrendingUp, ArrowUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getInitials } from '@/lib/utils';
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
  const { company } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'open'),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('company_id', company.id).gte('created_at', todayStart.toISOString()),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('company_id', company.id).in('status', ['running', 'scheduled']),
      supabase.from('leads').select('stage').eq('company_id', company.id),
    ]).then(([contacts, openConvs, msgsToday, activeCampaigns, leads]) => {
      const leadsByStage: Record<string, number> = {};
      if (leads.data) {
        for (const lead of leads.data) {
          leadsByStage[lead.stage] = (leadsByStage[lead.stage] ?? 0) + 1;
        }
      }
      setStats({
        total_contacts: contacts.count ?? 0,
        open_conversations: openConvs.count ?? 0,
        messages_today: msgsToday.count ?? 0,
        active_campaigns: activeCampaigns.count ?? 0,
        leads_by_stage: leadsByStage as Record<LeadStage, number>,
        agent_performance: [],
      });
    }).finally(() => setLoading(false));
  }, [company?.id]);

  const statCards = [
    { label: 'Total Contacts', value: stats?.total_contacts ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Conversations', value: stats?.open_conversations ?? 0, icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Messages Today', value: stats?.messages_today ?? 0, icon: ArrowUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active Campaigns', value: stats?.active_campaigns ?? 0, icon: Megaphone, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div>
      <Header title="Dashboard" subtitle="Your workspace at a glance" />
      <div className="p-4 sm:p-6 space-y-6">
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
              ) : stats?.leads_by_stage && Object.keys(stats.leads_by_stage).length > 0 ? (
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
