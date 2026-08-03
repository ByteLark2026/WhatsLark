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
const res = await client.query(`
  SELECT status, count(*), count(wa_template_id) as submitted
  FROM message_templates
  WHERE company_id = '18f23790-a764-4dce-b1d5-408d0ce21b21'
  GROUP BY status;
`);
console.table(res.rows);
await client.end();
