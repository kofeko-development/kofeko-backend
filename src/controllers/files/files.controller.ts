import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { env } from '../../config/env';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function assertSafeUploadPath(filePath: string): void {
  if (!filePath.startsWith('uploads/') || filePath.includes('..')) {
    throw new AppError('File not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }
}

export const serveStorageFile = catchAsync(async (req: Request, res: Response) => {
  const rawPath = req.params.path as string | string[] | undefined;
  const filePath = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath ?? '');
  assertSafeUploadPath(filePath);

  const provider = (env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (provider === 'supabase') {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = env.SUPABASE_STORAGE_BUCKET;

    if (!supabaseUrl || !serviceRoleKey || !bucket) {
      throw new AppError('File not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error || !data) {
      throw new AppError('File not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.set('Content-Type', contentTypeForPath(filePath));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(StatusCodes.OK).send(buffer);
    return;
  }

  const localPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(localPath)) {
    throw new AppError('File not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.type(contentTypeForPath(filePath));
  res.sendFile(localPath);
});
