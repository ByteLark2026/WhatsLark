import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL — set it in apps/api/.env or your shell environment (Supabase project pooler connection string).');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(`ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS meta_app_id TEXT;`);
await client.end();
console.log('✅ meta_app_id column ensured on whatsapp_channels.');
