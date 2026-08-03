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
const res = await client.query(`SELECT id, name, status, channel_id, template_id, total_recipients, sent_count, delivered_count, read_count, failed_count, replied_count, scheduled_at FROM campaigns;`);
console.table(res.rows);
await client.end();
