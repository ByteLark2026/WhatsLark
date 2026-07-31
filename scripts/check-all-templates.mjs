import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const res = await client.query(`SELECT id, name, status, wa_template_id FROM message_templates ORDER BY name;`);
console.table(res.rows);
await client.end();
