/* eslint-disable no-console */
// One-off: copy every object from the Supabase storage bucket into S3 with the same key.
// Usage (from kofeko-backend, with AWS credentials configured locally):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_STORAGE_BUCKET=... \
//   S3_BUCKET=... AWS_REGION=ap-south-1 node scripts/migrate-supabase-storage-to-s3.js
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, S3_BUCKET } = process.env;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET || !S3_BUCKET) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET and S3_BUCKET');
  process.exit(1);
}

const storage = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from(
  SUPABASE_STORAGE_BUCKET,
);
const s3 = new S3Client({ region: AWS_REGION });

async function listAll(prefix) {
  const keys = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back without an id
      if (item.id === null) keys.push(...(await listAll(path)));
      else keys.push({ path, contentType: item.metadata?.mimetype });
    }
    if (data.length < 1000) return keys;
  }
}

async function existsInS3(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const objects = await listAll('');
  console.log(`Found ${objects.length} objects in Supabase bucket ${SUPABASE_STORAGE_BUCKET}`);
  let copied = 0;
  let skipped = 0;
  for (const { path, contentType } of objects) {
    if (await existsInS3(path)) {
      skipped++;
      continue;
    }
    const { data, error } = await storage.download(path);
    if (error) {
      console.warn(`FAILED download ${path}: ${error.message}`);
      continue;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: path,
        Body: Buffer.from(await data.arrayBuffer()),
        ContentType: contentType || data.type || 'application/octet-stream',
      }),
    );
    copied++;
    console.log(`copied ${path}`);
  }
  console.log(`Done. copied=${copied} skipped(already in S3)=${skipped}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
