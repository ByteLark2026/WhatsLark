-- ============================================================
-- WhatsLark — Seed / Demo Data
-- Migration: 003_seed_data.sql
-- Run AFTER setting up Supabase Auth users manually or via API
-- ============================================================

-- Demo company
INSERT INTO companies (id, name, slug, status, plan, timezone, trial_ends_at)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Acme Corp Demo',
  'acme-demo',
  'active',
  'growth',
  'Asia/Kuala_Lumpur',
  NOW() + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- Tags
INSERT INTO tags (company_id, name, color) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'VIP', '#F59E0B'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Hot Lead', '#EF4444'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Follow Up', '#3B82F6'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Support', '#10B981')
ON CONFLICT DO NOTHING;

-- Demo contacts
INSERT INTO contacts (company_id, phone, name, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '+60123456789', 'Ahmad bin Ali', 'ahmad@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '+60198765432', 'Siti Nurhaliza', 'siti@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '+601112223334', 'John Smith', 'john@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '+6591234567', 'Priya Sharma', 'priya@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '+66812345678', 'Somchai K.', 'somchai@example.com')
ON CONFLICT DO NOTHING;

-- Demo message template
INSERT INTO message_templates (company_id, name, language, category, status, components) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'welcome_message',
    'en_US',
    'UTILITY',
    'approved',
    '[
      {"type":"HEADER","format":"TEXT","text":"Welcome to {{1}}!"},
      {"type":"BODY","text":"Hi {{2}}, thank you for contacting us. Our team will assist you shortly."},
      {"type":"FOOTER","text":"WhatsLark — WhatsApp CRM"}
    ]'::jsonb
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'follow_up_reminder',
    'en_US',
    'MARKETING',
    'approved',
    '[
      {"type":"BODY","text":"Hi {{1}}, just following up on our previous conversation. Are you still interested in our offer?"},
      {"type":"BUTTONS","buttons":[{"type":"QUICK_REPLY","text":"Yes, interested"},{"type":"QUICK_REPLY","text":"Not now"}]}
    ]'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Quick replies
INSERT INTO quick_replies (company_id, shortcut, message, created_by)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  shortcut,
  message,
  id
FROM (VALUES
  ('hi', 'Hi! Thank you for reaching out. How can I help you today?'),
  ('bye', 'Thank you for contacting us. Have a great day!'),
  ('wait', 'Please give me a moment while I check that for you.')
) AS qr(shortcut, message)
CROSS JOIN (SELECT id FROM users WHERE is_super_admin = TRUE LIMIT 1) u
ON CONFLICT DO NOTHING;

-- AI settings
INSERT INTO ai_settings (company_id, is_enabled, auto_reply, handover_keyword, system_prompt, model) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    TRUE,
    FALSE,
    'agent',
    'You are a helpful customer support assistant for Acme Corp. Be friendly, concise, and professional. If you cannot answer a question, offer to connect the customer with a human agent.',
    'gpt-4o-mini'
  )
ON CONFLICT DO NOTHING;

-- Automation rules
INSERT INTO automation_rules (company_id, name, is_active, trigger, trigger_config, actions) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Welcome new contacts',
    TRUE,
    'new_contact',
    '{}',
    '[{"type":"send_message","config":{"message":"Welcome! How can we help you today?"}}]'::jsonb
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Keyword: price',
    TRUE,
    'keyword_matched',
    '{"keywords":["price","pricing","how much","cost"]}',
    '[{"type":"add_tag","config":{"tag_name":"Hot Lead"}},{"type":"assign_agent","config":{}}]'::jsonb
  )
ON CONFLICT DO NOTHING;
