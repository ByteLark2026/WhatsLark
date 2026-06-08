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
}
