import crypto from 'node:crypto';

const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getInviteTokenExpiryDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TOKEN_TTL_MS);
}

export function getResetTokenExpiryDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS);
}
