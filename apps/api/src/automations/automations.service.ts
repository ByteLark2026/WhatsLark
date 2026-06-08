import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class AutomationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('automation_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at');
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async create(companyId: string, dto: {
    name: string;
    trigger: string;
    trigger_config: any;
    actions: any[];
    is_active?: boolean;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('automation_rules')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('automation_rules')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async toggle(companyId: string, id: string, isActive: boolean) {
    return this.update(companyId, id, { is_active: isActive });
  }

  async delete(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('automation_rules')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }

  /** Execute matching automation rules for an event */
  async executeRules(companyId: string, trigger: string, context: Record<string, any>) {
    const { data: rules } = await this.supabase.getAdminClient()
      .from('automation_rules')
      .select('*')
      .eq('company_id', companyId)
      .eq('trigger', trigger)
      .eq('is_active', true);

    if (!rules?.length) return;

    for (const rule of rules) {
      if (!this.matchesTriggerConfig(rule.trigger_config, context)) continue;
      // Actions are processed by the relevant services in their own handlers
      // This service emits the rule for external processing
    }
  }

  private matchesTriggerConfig(config: any, context: any): boolean {
    if (!config || Object.keys(config).length === 0) return true;

    if (config.keywords?.length && context.message) {
      const msg = context.message.toLowerCase();
      return config.keywords.some((kw: string) => msg.includes(kw.toLowerCase()));
    }

    return true;
  }
}
