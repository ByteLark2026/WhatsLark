-- Meta only requires a template name to be unique per WABA (per channel), not per company.
-- The old constraint blocked reusing the same name across two different channels — the exact
-- thing you need when the same promo/notification content is approved separately per number.
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_company_id_name_key;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_company_channel_name_key UNIQUE (company_id, channel_id, name);
