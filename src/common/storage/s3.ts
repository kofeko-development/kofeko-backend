import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '../../config/env';

let client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!client) client = new S3Client({ region: env.AWS_REGION });
  return client;
}

export async function putS3Object(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

/** Returns null when the object does not exist. */
export async function getS3Object(
  key: string,
): Promise<{ body: Buffer; contentType?: string } | null> {
  try {
    const out = await getS3Client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!out.Body) return null;
    return {
      body: Buffer.from(await out.Body.transformToByteArray()),
      contentType: out.ContentType,
    };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound' || name === 'AccessDenied') return null;
    throw err;
  }
}
