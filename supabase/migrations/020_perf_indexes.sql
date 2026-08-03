-- Composite index matching the actual inbox list query shape:
-- WHERE company_id = ? [AND status = ?] ORDER BY last_message_at DESC
CREATE INDEX idx_conversations_company_status_lastmsg
  ON conversations(company_id, status, last_message_at DESC);

-- Matches campaign.processor.ts's unprocessed-recipient scan and
-- webhook.service.ts's delivery-status update, both filtered/looked up
-- by (status, wa_message_id).
CREATE INDEX idx_campaign_recipients_status_wamsg
  ON campaign_recipients(status, wa_message_id);
