import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const res = await client.query(`
  SELECT status, count(*), count(wa_template_id) as submitted
  FROM message_templates
  WHERE company_id = '18f23790-a764-4dce-b1d5-408d0ce21b21'
  GROUP BY status;
`);
console.table(res.rows);
await client.end();
