import crypto from 'node:crypto';

/**
 * Human-readable temporary password for invite emails (user should change it via accept-invite / first login).
 * 16 characters from a broad charset; cryptographically random.
 */
export function generateReadableTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const bytes = crypto.randomBytes(18);
  let pwd = '';
  for (let i = 0; i < 16; i++) {
    pwd += all[bytes[i] % all.length];
  }
  return pwd;
}
