import crypto from 'crypto';
import { env } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = env.APP_ENCRYPT_KEY ?? env.LINKEDIN_ENCRYPT_KEY;
  if (!key || key.length < 32) {
    throw new Error('APP_ENCRYPT_KEY or LINKEDIN_ENCRYPT_KEY must be at least 32 characters');
  }
  return Buffer.from(key.slice(0, 32), 'utf8');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
