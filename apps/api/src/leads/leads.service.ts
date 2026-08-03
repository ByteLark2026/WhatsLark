import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { ScoringService } from '../scoring/scoring.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoring: ScoringService,
  ) {}

  async list(companyId: string, opts: { stage?: string; assigned_to?: string; page?: number; limit?: number } = {}) {
    const { stage, assigned_to } = opts;
    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('leads')
      .select(`
        *,
        contacts (id, name, phone, avatar_url),
        users:assigned_to (id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (stage) query = query.eq('stage', stage);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async getByStage(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .select(`
        *,
        contacts (id, name, phone, avatar_url),
        users:assigned_to (id, full_name, avatar_url)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const stages = ['new_lead', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost'];
    return stages.reduce((acc, stage) => {
      acc[stage] = (data || []).filter(l => l.stage === stage);
      return acc;
    }, {} as Record<string, any[]>);
  }

  async get(companyId: string, id: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .select(`*, contacts (*), users:assigned_to (id, full_name, avatar_url)`)
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Lead not found');
    return data;
  }

  async create(companyId: string, dto: {
    contact_id: string;
    conversation_id?: string;
    assigned_to?: string;
    stage?: string;
    title: string;
    deal_value?: number;
    currency?: string;
    expected_close_date?: string;
    notes?: string;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    // fire-and-forget score
    this.applyScoreAfterMutation(companyId, data.id).catch(() => null);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    this.applyScoreAfterMutation(companyId, id).catch(() => null);
    return data;
  }

  async moveStage(companyId: string, id: string, stage: string) {
    return this.update(companyId, id, { stage });
  }

  async delete(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }

  async getForecast(companyId: string) {
    const STAGE_CONFIG: Record<string, { name: string; probability: number; color: string }> = {
      new_lead:       { name: 'New Lead',        probability: 10,  color: '#94a3b8' },
      qualified:      { name: 'Qualified',        probability: 25,  color: '#3b82f6' },
      quotation_sent: { name: 'Quotation Sent',   probability: 50,  color: '#f59e0b' },
      negotiation:    { name: 'Negotiation',       probability: 75,  color: '#8b5cf6' },
      won:            { name: 'Won',               probability: 100, color: '#22c55e' },
      lost:           { name: 'Lost',              probability: 0,   color: '#ef4444' },
    };

    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .select('stage, deal_value, currency, created_at')
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);
    const leads = data || [];

    const byStage = Object.entries(STAGE_CONFIG).map(([key, cfg]) => {
      const stageLeads = leads.filter((l) => l.stage === key);
      const totalValue = stageLeads.reduce((s, l) => s + (l.deal_value || 0), 0);
      const weightedValue = Math.round(totalValue * cfg.probability / 100);
      return {
        stage: key,
        name: cfg.name,
        probability: cfg.probability,
        color: cfg.color,
        count: stageLeads.length,
        total_value: totalValue,
        weighted_value: weightedValue,
      };
    });

    const activeStages = byStage.filter((s) => s.stage !== 'lost');
    const totalPipeline = activeStages.reduce((s, st) => s + st.total_value, 0);
    const weightedForecast = activeStages.reduce((s, st) => s + st.weighted_value, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const wonThisMonth = leads
      .filter((l) => l.stage === 'won' && l.created_at >= monthStart)
      .reduce((s, l) => s + (l.deal_value || 0), 0);

    const wonLeads = leads.filter((l) => l.stage === 'won').length;
    const closedLeads = leads.filter((l) => l.stage === 'won' || l.stage === 'lost').length;
    const winRate = closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 100) : 0;

    return {
      by_stage: byStage,
      total_pipeline: totalPipeline,
      weighted_forecast: weightedForecast,
      won_this_month: wonThisMonth,
      win_rate: winRate,
      total_leads: leads.length,
    };
  }

  async applyScoreAfterMutation(companyId: string, leadId: string): Promise<void> {
    // Delegates to ScoringService so there is exactly one scoring formula in the app
    // (previously this duplicated a slightly different formula from ScoringService).
    await this.scoring.applyScore(companyId, leadId);
  }
}
