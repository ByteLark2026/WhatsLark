import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

const STAGE_BASE_SCORE: Record<string, number> = {
  new_lead: 5,
  qualified: 15,
  quotation_sent: 20,
  negotiation: 35,
  won: 50,
  lost: 0,
};

function dealValueScore(val: number | null): number {
  if (!val || val <= 0) return 0;
  if (val < 1000) return 5;
  if (val < 5000) return 15;
  if (val < 20000) return 25;
  if (val < 100000) return 35;
  return 40;
}

function gradeFromScore(score: number): string {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 15) return 'cold';
  return 'dead';
}

@Injectable()
export class ScoringService {
  constructor(private readonly supabase: SupabaseService) {}

  computeScore(lead: { stage?: string; deal_value?: number | null; notes?: string | null }, contact?: { email?: string | null }): {
    score: number;
    grade: string;
    factors: { label: string; points: number }[];
  } {
    const factors: { label: string; points: number }[] = [];

    const stageScore = STAGE_BASE_SCORE[lead.stage || 'new_lead'] ?? 5;
    factors.push({ label: `Stage: ${lead.stage || 'new_lead'}`, points: stageScore });

    const dvScore = dealValueScore(lead.deal_value ?? null);
    if (dvScore > 0) factors.push({ label: `Deal value: ${lead.deal_value}`, points: dvScore });

    if (contact?.email) factors.push({ label: 'Has email', points: 5 });
    if (lead.notes?.trim()) factors.push({ label: 'Has notes', points: 5 });

    const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
    return { score, grade: gradeFromScore(score), factors };
  }

  async applyScore(companyId: string, leadId: string): Promise<void> {
    const { data: lead } = await this.supabase.getAdminClient()
      .from('leads')
      .select('*, contacts(email)')
      .eq('id', leadId)
      .eq('company_id', companyId)
      .single();

    if (!lead) return;

    const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
    const { score, grade } = this.computeScore(lead, contact);

    await this.supabase.getAdminClient()
      .from('leads')
      .update({ score, score_grade: grade })
      .eq('id', leadId)
      .eq('company_id', companyId);
  }

  async recalculateAll(companyId: string): Promise<{ updated: number }> {
    const { data: leads } = await this.supabase.getAdminClient()
      .from('leads')
      .select('id, stage, deal_value, notes, contacts(email)')
      .eq('company_id', companyId);

    if (!leads?.length) return { updated: 0 };

    const updates = leads.map((lead) => {
      const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
      const { score, grade } = this.computeScore(lead, contact);
      return { id: lead.id, score, score_grade: grade };
    });

    for (const u of updates) {
      await this.supabase.getAdminClient()
        .from('leads')
        .update({ score: u.score, score_grade: u.score_grade })
        .eq('id', u.id)
        .eq('company_id', companyId);
    }

    return { updated: updates.length };
  }

  async getScoreRules(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('scoring_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async createRule(companyId: string, dto: {
    name: string;
    event_type: string;
    condition?: object;
    points: number;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('scoring_rules')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateRule(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('scoring_rules')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteRule(companyId: string, id: string) {
    const { error } = await this.supabase.getAdminClient()
      .from('scoring_rules')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getScoredLeads(companyId: string, opts: { grade?: string; page?: number; limit?: number } = {}) {
    const { grade, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;

    let query = this.supabase.getAdminClient()
      .from('leads')
      .select(`
        id, title, score, score_grade, stage, deal_value, currency, expected_close_date,
        contacts (id, name, phone, avatar_url),
        users:assigned_to (id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (grade) query = query.eq('score_grade', grade);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }
}
