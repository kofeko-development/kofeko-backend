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

