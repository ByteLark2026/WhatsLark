import pg from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL — set it in apps/api/.env or your shell environment.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tpl = await client.query(`SELECT id, company_id, name, status, wa_template_id, language, category FROM message_templates ORDER BY created_at DESC LIMIT 10;`);
console.log('--- Templates ---');
console.table(tpl.rows);

const ch = await client.query(`SELECT id, company_id, name, business_account_id, phone_number_id, meta_app_id, is_active, length(access_token) as token_len FROM whatsapp_channels;`);
console.log('--- Channels ---');
console.table(ch.rows);

await client.end();
