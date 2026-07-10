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
    const { campaignId } = job.data;
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

    // Load unprocessed recipients: status='sent' and wa_message_id IS NULL
    // (status enum has no 'pending' value; wa_message_id=null means not yet sent to WhatsApp)
    const { data: recipients } = await this.supabase.getAdminClient()
      .from('campaign_recipients')
      .select('*, contacts (phone, name)')
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')
      .is('wa_message_id', null);

    if (!recipients?.length) {
      await this.finishCampaign(campaignId);
      return;
    }

    const template = campaign.message_templates;
    const templateVariables: Record<string, string> = campaign.template_variables || {};
    this.logger.log(`Template raw: name="${template?.name}" lang="${template?.language}" components=${JSON.stringify(template?.components)}`);
    this.logger.log(`Template variables: ${JSON.stringify(templateVariables)}`);
    const components = this.buildTemplateComponents(template?.components || [], templateVariables);
    this.logger.log(`Template components built: ${JSON.stringify(components)}`);

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

      const phone = (recipient.contacts?.phone || '').replace(/\D/g, '');
      if (!phone || phone.length < 10 || phone.startsWith('0')) {
        this.logger.warn(`Skipping recipient ${recipient.id}: invalid phone "${recipient.contacts?.phone}"`);
        await this.supabase.getAdminClient()
          .from('campaign_recipients')
          .update({ status: 'failed', error_message: `Invalid phone number: ${recipient.contacts?.phone}. Must be international format (e.g. 971508705487).`, failed_at: new Date().toISOString() })
          .eq('id', recipient.id);
        failedCount++;
        continue;
      }

      try {
        const waMessageId = await this.whatsapp.sendTemplateMessage(
          campaign.channel_id,
          phone,
          template.name,
          template.language,
          components,
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
        const errorMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
        const errorCode = err.response?.data?.error?.code;
        const fullError = errorCode ? `[${errorCode}] ${errorMsg}` : errorMsg;
        this.logger.error(`Failed to send to ${phone}: ${fullError}`);
        await this.supabase.getAdminClient()
          .from('campaign_recipients')
          .update({ status: 'failed', error_message: fullError, failed_at: new Date().toISOString() })
          .eq('id', recipient.id);
        failedCount++;
      }
    }

    // Update campaign stats
    const { data: currentStats } = await this.supabase.getAdminClient()
      .from('campaigns')
      .select('sent_count, failed_count')
      .eq('id', campaignId)
      .single();

    await this.supabase.getAdminClient()
      .from('campaigns')
      .update({
        sent_count: (currentStats?.sent_count || 0) + sentCount,
        failed_count: (currentStats?.failed_count || 0) + failedCount,
      })
      .eq('id', campaignId);

    await this.finishCampaign(campaignId);
  }

  // Build WhatsApp template component parameters.
  // templateVariables: { "body_1": "value", "body_2": "value", "header_1": "value", "button_0": "value" }
  private buildTemplateComponents(templateComponents: any[], templateVariables: Record<string, string> = {}): any[] {
    const result: any[] = [];

    for (const comp of templateComponents) {
      if (comp.type === 'BODY' && comp.text) {
        const vars = [...comp.text.matchAll(/\{\{(\w+)\}\}/g)];
        if (vars.length > 0) {
          result.push({
            type: 'body',
            parameters: vars.map((_m, i) => ({
              type: 'text',
              // Use stored variable value, fall back to template example, then generic sample
              text: templateVariables[`body_${i + 1}`]
                || comp.example?.body_text?.[0]?.[i]
                || `Sample${i + 1}`,
            })),
          });
        }
      }

      if (comp.type === 'HEADER') {
        const format = comp.format || 'TEXT';
        if (format === 'TEXT' && comp.text) {
          const vars = [...comp.text.matchAll(/\{\{(\w+)\}\}/g)];
          if (vars.length > 0) {
            result.push({
              type: 'header',
              parameters: vars.map((_m, i) => ({
                type: 'text',
                text: templateVariables[`header_${i + 1}`]
                  || comp.example?.header_text?.[i]
                  || `Sample${i + 1}`,
              })),
            });
          }
        }
      }

      // Dynamic URL buttons require a BUTTON component with the suffix parameter
      if (comp.type === 'BUTTONS') {
        for (let idx = 0; idx < (comp.buttons || []).length; idx++) {
          const btn = comp.buttons[idx];
          if (btn.type === 'URL' && btn.url && /\{\{/.test(btn.url)) {
            result.push({
              type: 'button',
              sub_type: 'url',
              index: idx,
              parameters: [{ type: 'text', text: templateVariables[`button_${idx}`] || btn.example?.[0] || 'track' }],
            });
          }
        }
      }
    }

    return result;
  }

  private async finishCampaign(campaignId: string) {
    await this.supabase.getAdminClient()
      .from('campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignId);
    this.logger.log(`Campaign ${campaignId} completed`);
  }
}
