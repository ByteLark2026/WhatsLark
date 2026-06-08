import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SupabaseService } from '../common/supabase.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Processor('campaigns')
export class CampaignProcessor {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Process('send-campaign')
  async processCampaign(job: Job<{ campaignId: string; companyId: string }>) {
    const { campaignId, companyId } = job.data;
    this.logger.log(`Processing campaign ${campaignId}`);

    // Load campaign + template
    const { data: campaign } = await this.supabase.getAdminClient()
      .from('campaigns')
      .select('*, message_templates (*)')
      .eq('id', campaignId)
      .single();

    if (!campaign || campaign.status !== 'running') {
      this.logger.warn(`Campaign ${campaignId} not in running state`);
      return;
    }

    // Load pending recipients
    const { data: recipients } = await this.supabase.getAdminClient()
      .from('campaign_recipients')
      .select('*, contacts (phone)')
      .eq('campaign_id', campaignId)
      .eq('status', 'sent'); // not yet actually sent

    if (!recipients?.length) {
      await this.finishCampaign(campaignId);
      return;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      // Check if campaign was paused
      const { data: check } = await this.supabase.getAdminClient()
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();

      if (check?.status === 'paused') {
        this.logger.log(`Campaign ${campaignId} paused at ${sentCount} sent`);
        break;
      }

      try {
        const phone = recipient.contacts.phone;
        const template = campaign.message_templates;

        const waMessageId = await this.whatsapp.sendTemplateMessage(
          campaign.channel_id,
          phone,
          template.name,
          template.language,
          [], // template components — customise per campaign
        );

        await this.supabase.getAdminClient()
          .from('campaign_recipients')
          .update({
            wa_message_id: waMessageId,
            sent_at: new Date().toISOString(),
            status: 'sent',
          })
          .eq('id', recipient.id);

        sentCount++;

        // Throttle: 1 message per second to respect Meta rate limits
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        this.logger.error(`Failed to send to ${recipient.contacts?.phone}: ${err.message}`);
        await this.supabase.getAdminClient()
          .from('campaign_recipients')
          .update({ status: 'failed', error_message: err.message, failed_at: new Date().toISOString() })
          .eq('id', recipient.id);
        failedCount++;
      }
    }

    await this.supabase.getAdminClient()
      .from('campaigns')
      .update({ sent_count: sentCount, failed_count: failedCount })
      .eq('id', campaignId);

    await this.finishCampaign(campaignId);
  }

  private async finishCampaign(campaignId: string) {
    await this.supabase.getAdminClient()
      .from('campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignId);
    this.logger.log(`Campaign ${campaignId} completed`);
  }
}
