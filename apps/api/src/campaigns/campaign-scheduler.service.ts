import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase.service';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly campaigns: CampaignsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async launchDueCampaigns() {
    const { data: due } = await this.supabase.getAdminClient()
      .from('campaigns')
      .select('id, company_id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (!due?.length) return;

    for (const campaign of due) {
      try {
        await this.campaigns.launch(campaign.company_id, campaign.id);
        this.logger.log(`Auto-launched scheduled campaign ${campaign.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to auto-launch campaign ${campaign.id}: ${err.message}`);
      }
    }
  }
}
