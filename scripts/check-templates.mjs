import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
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
