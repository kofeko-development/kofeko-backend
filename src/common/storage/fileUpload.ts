import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import admin from 'firebase-admin';

import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { env } from '../../config/env';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const provider = (env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (provider === 'supabase') {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = env.SUPABASE_STORAGE_BUCKET;

    if (!supabaseUrl || !serviceRoleKey || !bucket) {
      throw new AppError(
        'Supabase storage is not configured. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET.',
        500,
        ERROR_CODES.STORAGE_ERROR,
      );
    }

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
      throw new AppError(`Supabase storage upload failed: ${uploadError.message}`, 500, ERROR_CODES.STORAGE_ERROR);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(key);

    if (!data?.publicUrl) {
      throw new AppError('Supabase storage returned no public URL after upload.', 500, ERROR_CODES.STORAGE_ERROR);
    }

    return data.publicUrl;
  }

  if (provider === 'firebase') {
    if (!admin.apps.length) {
      const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !privateKey || !env.FIREBASE_STORAGE_BUCKET) {
        throw new AppError(
          'Firebase storage env vars are not configured',
          500,
          ERROR_CODES.INTERNAL_SERVER_ERROR,
        );
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
  }

  // local
  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const key = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
  const outPath = path.join(uploadsDir, key);
  fs.writeFileSync(outPath, buffer);

  const port = String(env.PORT || 3000);
  return `http://localhost:${port}/uploads/${key}`;
}

