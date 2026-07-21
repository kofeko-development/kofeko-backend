import crypto from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { StatusCodes } from 'http-status-codes';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { encrypt, decrypt } from '../../common/utils/encrypt';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';

const BACKUP_CODE_COUNT = 8;
const ISSUER = 'Kofeko Superadmin';
/** ±1 TOTP step at default 30s period */
const TOTP_EPOCH_TOLERANCE = 30;

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase(),
  );
}

async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => hashPassword(code)));
}

async function verifyBackupCode(code: string, hashes: string[]): Promise<number> {
  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await comparePassword(normalized, hashes[i])) {
      return i;
    }
  }
  return -1;
}

async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  const result = await verify({
    secret,
    token: token.replace(/\s/g, ''),
    epochTolerance: TOTP_EPOCH_TOLERANCE,
  });
  return result.valid;
}

async function verifyTotpOrBackup(
  admin: { twoFactorSecret: string | null; twoFactorBackupCodes: string[] },
  code: string,
): Promise<'totp' | 'backup'> {
  if (!admin.twoFactorSecret) {
    throw new AppError('Two-factor authentication is not configured', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  const secret = decrypt(admin.twoFactorSecret);
  const normalized = code.replace(/\s/g, '');

  if (await verifyTotpToken(secret, normalized)) {
    return 'totp';
  }

  const backupIndex = await verifyBackupCode(normalized, admin.twoFactorBackupCodes);
  if (backupIndex >= 0) {
    return 'backup';
  }

  throw new AppError('Invalid verification code', StatusCodes.UNAUTHORIZED, ERROR_CODES.OTP_INVALID);
}

export const superAdminTwoFactorService = {
  async setup(superAdminId: string) {
    const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!admin) {
      throw new AppError('Super admin not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const secret = generateSecret();
    const encryptedSecret = encrypt(secret);

    await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: {
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
      },
    });

    const otpauthUrl = generateURI({
      issuer: ISSUER,
      label: admin.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { otpauthUrl, qrDataUrl };
  },

  async verifySetup(superAdminId: string, code: string) {
    const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!admin?.twoFactorSecret) {
      throw new AppError('Start 2FA setup first', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const secret = decrypt(admin.twoFactorSecret);
    const normalized = code.replace(/\s/g, '');
    if (!(await verifyTotpToken(secret, normalized))) {
      throw new AppError('Invalid verification code', StatusCodes.UNAUTHORIZED, ERROR_CODES.OTP_INVALID);
    }

    const backupCodes = generateBackupCodes();
    const backupHashes = await hashBackupCodes(backupCodes);

    await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: backupHashes,
      },
    });

    return { backupCodes };
  },

  async disable(superAdminId: string, code: string) {
    const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!admin?.twoFactorEnabled) {
      throw new AppError('Two-factor authentication is not enabled', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    await verifyTotpOrBackup(admin, code);

    await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });
  },

  async status(superAdminId: string) {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: superAdminId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: admin?.twoFactorEnabled ?? false };
  },

  async verifyLoginCode(
    superAdminId: string,
    code: string,
  ): Promise<'totp' | 'backup'> {
    const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!admin?.twoFactorEnabled || !admin.twoFactorSecret) {
      throw new AppError('Two-factor authentication is not enabled', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const method = await verifyTotpOrBackup(admin, code);

    if (method === 'backup') {
      const backupIndex = await verifyBackupCode(code, admin.twoFactorBackupCodes);
      const remaining = admin.twoFactorBackupCodes.filter((_, i) => i !== backupIndex);
      await prisma.superAdmin.update({
        where: { id: superAdminId },
        data: { twoFactorBackupCodes: remaining },
      });
    }

    return method;
  },
};
