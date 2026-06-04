import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import admin from 'firebase-admin';

import { env } from '../../config/env';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function uploadLocal(buffer: Buffer, filename: string): string {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const key = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
  const outPath = path.join(uploadsDir, key);
  fs.writeFileSync(outPath, buffer);

  const port = String(env.PORT || 5000);
  return `http://localhost:${port}/uploads/${key}`;
}

export async function uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const provider = (env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (provider === 'supabase') {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = env.SUPABASE_STORAGE_BUCKET;

    if (!supabaseUrl || !serviceRoleKey || !bucket) {
      console.warn('Supabase storage env missing, falling back to local storage.');
      return uploadLocal(buffer, filename);
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      const key = `uploads/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(key, buffer, {
        contentType: mimeType,
        upsert: false,
      });

      if (uploadError) {
        console.warn(`Supabase storage upload failed (${uploadError.message}), falling back to local storage.`);
        return uploadLocal(buffer, filename);
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(key);

      if (!data?.publicUrl) {
        console.warn('Supabase storage returned no public URL, falling back to local storage.');
        return uploadLocal(buffer, filename);
      }

      // Bucket must allow public read on uploads/* for logo preview in signup UI.
      return data.publicUrl;
    } catch (err) {
      console.warn('Supabase storage exception, falling back to local storage.', err);
      return uploadLocal(buffer, filename);
    }
  }

  if (provider === 'firebase') {
    try {
      if (!admin.apps.length) {
        const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !privateKey || !env.FIREBASE_STORAGE_BUCKET) {
          console.warn('Firebase storage env missing, falling back to local storage.');
          return uploadLocal(buffer, filename);
        }

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
          storageBucket: env.FIREBASE_STORAGE_BUCKET,
        });
      }

      const bucket = admin.storage().bucket();
      const key = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
      const file = bucket.file(`uploads/${key}`);
      await file.save(buffer, { metadata: { contentType: mimeType } });
      await file.makePublic();
      return file.publicUrl();
    } catch (err) {
      console.warn('Firebase storage exception, falling back to local storage.', err);
      return uploadLocal(buffer, filename);
    }
  }

  return uploadLocal(buffer, filename);
}
// End of fileUpload service

