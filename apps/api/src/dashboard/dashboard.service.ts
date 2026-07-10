import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  async getStats(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: totalContacts },
      { count: openConversations },
      { count: messagesToday },
      { count: activeCampaigns },
      { data: leadsByStage },
      { data: agentData },
    ] = await Promise.all([
      this.supabase.getAdminClient()
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId),

      this.supabase.getAdminClient()
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'open'),

      this.supabase.getAdminClient()
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', today.toISOString()),

      this.supabase.getAdminClient()
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'running'),

      this.supabase.getAdminClient()
        .from('leads')
        .select('stage')
        .eq('company_id', companyId),

      this.supabase.getAdminClient()
        .from('conversations')
        .select('assigned_to, status, users:assigned_to (id, full_name)')
        .eq('company_id', companyId)
        .not('assigned_to', 'is', null),
    ]);

    // Calculate leads by stage
    const stages = ['new_lead', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost'];
    const leadCounts = stages.reduce((acc, stage) => {
      acc[stage] = (leadsByStage || []).filter(l => l.stage === stage).length;
      return acc;
    }, {} as Record<string, number>);

    // Agent performance (simplified)
    const agentMap: Record<string, any> = {};
    (agentData || []).forEach((conv: any) => {
      const agent = conv.users;
      if (!agent) return;
      if (!agentMap[agent.id]) {
        agentMap[agent.id] = {
          agent_id: agent.id,
          agent_name: agent.full_name,
          open_conversations: 0,
          closed_today: 0,
        };
      }
      if (conv.status === 'open') agentMap[agent.id].open_conversations++;
    });

    return {
      total_contacts: totalContacts || 0,
      open_conversations: openConversations || 0,
      messages_today: messagesToday || 0,
      active_campaigns: activeCampaigns || 0,
      leads_by_stage: leadCounts,
      agent_performance: Object.values(agentMap),
    };
  }

  async getTeamPerformance(companyId: string, opts: { range?: string; agent_id?: string } = {}) {
    const { range = '7d', agent_id } = opts;
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const [
      { data: messages },
      { data: conversations },
      { data: leads },
      { data: members },
    ] = await Promise.all([
      this.supabase.getAdminClient()
        .from('messages')
        .select('created_by, direction, created_at')
        .eq('company_id', companyId)
        .eq('direction', 'outbound')
        .gte('created_at', sinceISO),

      this.supabase.getAdminClient()
        .from('conversations')
        .select('assigned_to, status, created_at, updated_at')
        .eq('company_id', companyId)
        .gte('created_at', sinceISO),

      this.supabase.getAdminClient()
        .from('leads')
        .select('assigned_to, stage, deal_value, created_at')
        .eq('company_id', companyId)
        .gte('created_at', sinceISO),

      this.supabase.getAdminClient()
        .from('company_users')
        .select('user_id, users (id, full_name, avatar_url, email)')
        .eq('company_id', companyId)
        .eq('is_active', true),
    ]);

    const agentMap: Record<string, any> = {};

    (members || []).forEach((m: any) => {
      const u = m.users;
      if (!u) return;
      if (agent_id && u.id !== agent_id) return;
      agentMap[u.id] = {
        agent_id: u.id,
        agent_name: u.full_name,
        agent_email: u.email,
        avatar_url: u.avatar_url,
        messages_sent: 0,
        conversations_opened: 0,
        conversations_closed: 0,
        leads_created: 0,
        deals_won: 0,
        revenue: 0,
      };
    });

    (messages || []).forEach((m: any) => {
      if (m.created_by && agentMap[m.created_by]) {
        agentMap[m.created_by].messages_sent++;
      }
    });

    (conversations || []).forEach((c: any) => {
      if (c.assigned_to && agentMap[c.assigned_to]) {
        agentMap[c.assigned_to].conversations_opened++;
        if (c.status === 'closed') agentMap[c.assigned_to].conversations_closed++;
      }
    });

    (leads || []).forEach((l: any) => {
      if (l.assigned_to && agentMap[l.assigned_to]) {
        agentMap[l.assigned_to].leads_created++;
        if (l.stage === 'won') {
          agentMap[l.assigned_to].deals_won++;
          agentMap[l.assigned_to].revenue += l.deal_value || 0;
        }
      }
    });

    const agents = Object.values(agentMap).sort(
      (a: any, b: any) => b.messages_sent - a.messages_sent
    );

    return {
      agents,
      range,
      since: sinceISO,
      totals: {
        messages_sent: agents.reduce((s: number, a: any) => s + a.messages_sent, 0),
        conversations_opened: agents.reduce((s: number, a: any) => s + a.conversations_opened, 0),
        conversations_closed: agents.reduce((s: number, a: any) => s + a.conversations_closed, 0),
        leads_created: agents.reduce((s: number, a: any) => s + a.leads_created, 0),
        deals_won: agents.reduce((s: number, a: any) => s + a.deals_won, 0),
        revenue: agents.reduce((s: number, a: any) => s + a.revenue, 0),
      },
    };
  }
}
