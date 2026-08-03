import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — set them in apps/api/.env or your shell environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = 'template-media';

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error('Failed to list buckets:', listError.message);
  process.exit(1);
}

if (buckets.find((b) => b.name === BUCKET)) {
  console.log(`Bucket "${BUCKET}" already exists.`);
} else {
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '16MB',
  });
  if (createError) {
    console.error('Failed to create bucket:', createError.message);
    process.exit(1);
  }
  console.log(`Bucket "${BUCKET}" created.`);
}

// Add storage policies allowing authenticated users to upload/update their own
// company-scoped files, and anyone to read (public bucket).
const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'template_media_public_read') THEN
    CREATE POLICY "template_media_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'template-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'template_media_auth_insert') THEN
    CREATE POLICY "template_media_auth_insert" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'template-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'template_media_auth_update') THEN
    CREATE POLICY "template_media_auth_update" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'template-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'template_media_auth_delete') THEN
    CREATE POLICY "template_media_auth_delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'template-media');
  END IF;
END
$$;
`;

try {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✅ Storage policies for template-media configured.');
} catch (err) {
  console.error('❌ Failed to set storage policies via pg:', err.message);
  console.log('\nPlease run this SQL in your Supabase dashboard → SQL Editor:');
  console.log('\n' + sql);
}
