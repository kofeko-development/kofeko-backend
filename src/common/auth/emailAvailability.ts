import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const EMAIL_ALREADY_USED_MESSAGE =
  'This email address has already been used. Please use a different email.';

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Ensures an email is not already tied to any company account (admin, HR, recruiter, etc.),
 * pending company registration, or candidate profile.
 */
export async function assertEmailAvailableForCompanyAccount(email: string): Promise<void> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) {
    throw new AppError('Email is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: normalized },
    select: { id: true },
  });
  if (existingUser) {
    throw new AppError(EMAIL_ALREADY_USED_MESSAGE, StatusCodes.CONFLICT, ERROR_CODES.EMAIL_ALREADY_IN_USE);
  }

  const pendingRegistration = await prisma.companyRegistrationRequest.findFirst({
    where: {
      adminEmail: normalized,
      status: 'pending',
    },
    select: { id: true },
  });
  if (pendingRegistration) {
    throw new AppError(EMAIL_ALREADY_USED_MESSAGE, StatusCodes.CONFLICT, ERROR_CODES.EMAIL_ALREADY_IN_USE);
  }

  const candidate = await prisma.candidate.findFirst({
    where: { email: normalized },
    select: { id: true },
  });
  if (candidate) {
    throw new AppError(EMAIL_ALREADY_USED_MESSAGE, StatusCodes.CONFLICT, ERROR_CODES.EMAIL_ALREADY_IN_USE);
  }
}
