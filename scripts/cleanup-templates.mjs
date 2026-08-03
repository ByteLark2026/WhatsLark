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

// Remove duplicate templates by name, keeping the one that was actually
// submitted to Meta (wa_template_id is set) if any, otherwise the oldest row.
const dedupe = await client.query(`
  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY company_id, name
             ORDER BY (wa_template_id IS NULL), created_at ASC
           ) AS rn
    FROM message_templates
  )
  DELETE FROM message_templates
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  RETURNING id;
`);
console.log(`Deleted ${dedupe.rowCount} duplicate template(s).`);

// Templates that were never actually submitted to Meta should not show as approved.
const reset = await client.query(`
  UPDATE message_templates
  SET status = 'pending'
  WHERE wa_template_id IS NULL AND status = 'approved'
  RETURNING id;
`);
console.log(`Reset ${reset.rowCount} unsubmitted template(s) from 'approved' to 'pending'.`);

const remaining = await client.query(`SELECT count(*) FROM message_templates;`);
console.log(`Remaining templates: ${remaining.rows[0].count}`);

await client.end();
