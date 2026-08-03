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
const res = await client.query(`SELECT company_id, name, count(*) FROM message_templates GROUP BY company_id, name HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 10;`);
console.table(res.rows);
const res2 = await client.query(`SELECT id, company_id, name, status, wa_template_id, created_at FROM message_templates WHERE name = 'ad_award_recognition';`);
console.table(res2.rows);
await client.end();
