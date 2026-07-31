import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://postgres.nbmmfsqqkvzbtrjidhqm:Mannarkkad%408129@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const res = await client.query(`SELECT id, name, status, channel_id, template_id, total_recipients, sent_count, delivered_count, read_count, failed_count, replied_count, scheduled_at FROM campaigns;`);
console.table(res.rows);
await client.end();
