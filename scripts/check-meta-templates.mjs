import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
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
