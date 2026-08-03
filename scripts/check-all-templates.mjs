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
const res = await client.query(`SELECT id, name, status, wa_template_id FROM message_templates ORDER BY name;`);
console.table(res.rows);
await client.end();
