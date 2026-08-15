import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

export interface PricingRules {
  min_margin_pct: number;
  discount_limit_pct: number;
  manager_approval_threshold_pct: number;
  below_cost_block: boolean;
}

const DEFAULT_RULES: PricingRules = {
  min_margin_pct: 0,
  discount_limit_pct: 100,
  manager_approval_threshold_pct: 0,
  below_cost_block: true,
};

@Injectable()
export class PricingRulesService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(companyId: string): Promise<PricingRules> {
    const { data } = await this.supabase.getAdminClient()
      .from('pricing_rules')
      .select('min_margin_pct, discount_limit_pct, manager_approval_threshold_pct, below_cost_block')
      .eq('company_id', companyId)
      .maybeSingle();
    return data ? { ...DEFAULT_RULES, ...data } : DEFAULT_RULES;
  }

  async upsert(companyId: string, dto: Partial<PricingRules>) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('pricing_rules')
      .upsert({ company_id: companyId, ...dto }, { onConflict: 'company_id' })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
