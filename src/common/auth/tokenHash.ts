import crypto from 'crypto';

export const createTokenHash = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
