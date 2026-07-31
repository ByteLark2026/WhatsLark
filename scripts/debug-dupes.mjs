import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const res = await client.query(`SELECT company_id, name, count(*) FROM message_templates GROUP BY company_id, name HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10;`);
console.table(res.rows);
const res2 = await client.query(`SELECT id, company_id, name, status, wa_template_id, created_at FROM message_templates WHERE name = 'ad_award_recognition';`);
console.table(res2.rows);
await client.end();
