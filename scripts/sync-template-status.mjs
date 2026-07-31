import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows: channels } = await client.query(`SELECT business_account_id, access_token FROM whatsapp_channels LIMIT 1;`);
const { business_account_id, access_token } = channels[0];

const url = `https://graph.facebook.com/v19.0/${business_account_id}/message_templates?fields=name,status,id,language&limit=200`;
const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
const json = await r.json();

if (!r.ok) {
  console.error('Meta API error:', JSON.stringify(json, null, 2));
  await client.end();
  process.exit(1);
}

function mapMetaStatus(status) {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return 'rejected';
    default:
      return 'pending';
  }
}

for (const tpl of json.data) {
  const status = mapMetaStatus(tpl.status);
  const res = await client.query(
    `UPDATE message_templates SET status = $1, wa_template_id = $2 WHERE name = $3 AND language = $4 RETURNING id, name`,
    [status, tpl.id, tpl.name, tpl.language],
  );
  console.log(`${tpl.name} (${tpl.status} -> ${status}): updated ${res.rowCount} row(s)`);
}

await client.end();
