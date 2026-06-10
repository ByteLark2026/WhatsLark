import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(`ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS meta_app_id TEXT;`);
await client.end();
console.log('✅ meta_app_id column ensured on whatsapp_channels.');
