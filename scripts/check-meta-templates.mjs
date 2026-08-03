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
const res = await client.query(`SELECT business_account_id, access_token FROM whatsapp_channels LIMIT 1;`);
const { business_account_id, access_token } = res.rows[0];
await client.end();

const url = `https://graph.facebook.com/v19.0/${business_account_id}/message_templates?fields=name,status,id,language,category`;
const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
const json = await r.json();
console.log('WABA:', business_account_id);
console.log(JSON.stringify(json, null, 2));
