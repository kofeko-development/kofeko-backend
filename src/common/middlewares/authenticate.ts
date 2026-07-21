import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { verifyAccessToken } from '../auth/jwt';
import { prisma } from '../../config/prisma';

const SESSION_EXPIRED_MESSAGE = 'Session expired, please log in again';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError(SESSION_EXPIRED_MESSAGE, StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token) as any;

    if (payload?.type === 'super_admin') {
      next(new AppError("You don't have permission to do this", StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
      return;
    }
    if (payload?.type === 'candidate') {
      next(new AppError("You don't have permission to do this", StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
      return;
    }

    req.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
    };

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { status: true },
    });

    if (!tenant) {
      next(new AppError(SESSION_EXPIRED_MESSAGE, StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED));
      return;
    }

    if (tenant.status === 'suspended') {
      next(new AppError('This account has been suspended. Contact support.', StatusCodes.FORBIDDEN, ERROR_CODES.TENANT_SUSPENDED));
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
      select: { status: true },
    });

    if (!user) {
      next(new AppError(SESSION_EXPIRED_MESSAGE, StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED));
      return;
    }

    if (user.status !== 'active') {
      next(new AppError('Your account has been suspended. Contact your company admin to restore access.', StatusCodes.FORBIDDEN, ERROR_CODES.USER_SUSPENDED));
      return;
    }

    next();
  } catch {
    next(new AppError(SESSION_EXPIRED_MESSAGE, StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED));
  }
};
