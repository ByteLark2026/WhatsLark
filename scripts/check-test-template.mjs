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
const res = await client.query(`SELECT id, name, components FROM message_templates WHERE name = 'test';`);
console.log(JSON.stringify(res.rows, null, 2));
await client.end();
