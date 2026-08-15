import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase.service';
import { QuotationsService } from '../quotations/quotations.service';

/**
 * Sends one automatic follow-up for RFQ-originated quotations that have sat
 * unanswered past the company's configured window (ai_settings.rfq_followup_hours,
 * 0 = disabled). Reuses shareDocumentViaWhatsApp (via QuotationsService.sendWhatsApp),
 * so this is already 24h-window aware — a follow-up outside the window falls back to
 * the approved template automatically instead of attempting a free-form send.
 */
@Injectable()
export class RfqFollowUpService {
  private readonly logger = new Logger(RfqFollowUpService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly quotations: QuotationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendDueFollowUps() {
    const admin = this.supabase.getAdminClient();

    const { data: companies } = await admin
      .from('ai_settings')
      .select('company_id, rfq_followup_hours')
      .gt('rfq_followup_hours', 0);
    if (!companies?.length) return;

    for (const company of companies) {
      const cutoff = new Date(Date.now() - company.rfq_followup_hours * 60 * 60 * 1000).toISOString();

      const { data: dueQuotes } = await admin
        .from('quotations')
        .select('id, rfq_id, created_by, sent_at')
        .eq('company_id', company.company_id)
        .eq('status', 'sent')
        .not('rfq_id', 'is', null)
        .is('follow_up_sent_at', null)
        .lte('sent_at', cutoff);
      if (!dueQuotes?.length) continue;

      for (const quote of dueQuotes) {
        try {
          if (await this.hasCustomerReplied(company.company_id, quote.rfq_id, quote.sent_at)) {
            // Customer already responded — the conversation moved on, no nagging follow-up needed.
            await admin.from('quotations').update({ follow_up_sent_at: new Date().toISOString() }).eq('id', quote.id);
            continue;
          }
          await this.quotations.sendWhatsApp(company.company_id, quote.created_by, quote.id);
          await admin.from('quotations').update({ follow_up_sent_at: new Date().toISOString() }).eq('id', quote.id);
          this.logger.log(`Sent RFQ follow-up for quotation ${quote.id}`);
        } catch (err: any) {
          this.logger.error(`RFQ follow-up failed for quotation ${quote.id}: ${err.message}`);
        }
      }
    }
  }

  private async hasCustomerReplied(companyId: string, rfqId: string, sinceIso: string): Promise<boolean> {
    const { data: rfq } = await this.supabase.getAdminClient()
      .from('rfqs')
      .select('conversation_id')
      .eq('id', rfqId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!rfq?.conversation_id) return false;

    const { data: reply } = await this.supabase.getAdminClient()
      .from('messages')
      .select('id')
      .eq('conversation_id', rfq.conversation_id)
      .eq('direction', 'inbound')
      .gt('created_at', sinceIso)
      .limit(1)
      .maybeSingle();
    return !!reply;
  }
}
