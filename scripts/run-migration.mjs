import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — set them in apps/api/.env or your shell environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Test if table already exists
const { error: checkError } = await supabase.from('widget_settings').select('id').limit(1);

if (!checkError) {
  console.log('✅ widget_settings table already exists — nothing to do.');
  process.exit(0);
}

if (checkError.code !== '42P01') {
  console.error('Unexpected error checking table:', checkError);
  process.exit(1);
}

console.log('Table does not exist yet, creating via Management API...');

// Use Supabase Management API to run SQL
const sql = `
CREATE TABLE IF NOT EXISTS widget_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Welcome!',
  subtitle        text NOT NULL DEFAULT 'How can we help?',
  site_name       text NOT NULL DEFAULT 'My Site Name',
  allowed_domain  text,
  chat_greeting   text NOT NULL DEFAULT 'Hi! How can I help you today?',
  response_time   text NOT NULL DEFAULT 'A few minutes',
  primary_color   text NOT NULL DEFAULT '#25d366',
  accent_color    text NOT NULL DEFAULT '#128c7e',
  logo_url        text,
  position        text NOT NULL DEFAULT 'bottom-right',
  style_preset    text NOT NULL DEFAULT 'modern',
  button_text     text NOT NULL DEFAULT 'Send us a message',
  search_placeholder text NOT NULL DEFAULT 'Search our Help Center',
  faqs_count      text NOT NULL DEFAULT '3',
  show_team_avatars boolean NOT NULL DEFAULT true,
  show_recent_faqs  boolean NOT NULL DEFAULT true,
  live_chat       boolean NOT NULL DEFAULT true,
  ai_auto_reply   boolean NOT NULL DEFAULT true,
  font_family     text NOT NULL DEFAULT 'System Default',
  button_style    text NOT NULL DEFAULT 'Solid Fill',
  shadow_intensity text NOT NULL DEFAULT 'Medium',
  animation_speed  text NOT NULL DEFAULT 'Normal',
  team_members    jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE widget_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'widget_settings' AND policyname = 'widget_settings_company_access') THEN
    CREATE POLICY "widget_settings_company_access" ON widget_settings
      USING (company_id = current_company_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'widget_settings' AND policyname = 'widget_settings_company_insert') THEN
    CREATE POLICY "widget_settings_company_insert" ON widget_settings
      FOR INSERT WITH CHECK (company_id = current_company_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'widget_settings' AND policyname = 'widget_settings_company_update') THEN
    CREATE POLICY "widget_settings_company_update" ON widget_settings
      FOR UPDATE USING (company_id = current_company_id());
  END IF;
END
$$;
`;

// Try Management API
const projectRef = 'nbmmfsqqkvzbtrjidhqm';

// We need a personal access token for the Management API.
// Alternatively, use a pg connection directly.
// Let's try the pg package approach.
try {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✅ widget_settings table created successfully!');
} catch (err) {
  console.error('❌ Failed to create table via pg:', err.message);
  console.log('\nPlease run this SQL in your Supabase dashboard → SQL Editor:');
  console.log('\n' + sql);
}
