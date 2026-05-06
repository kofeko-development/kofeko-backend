import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { verifyAccessToken } from '../auth/jwt';
import { prisma } from '../../config/prisma';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError('Missing or invalid authorization header', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token) as any;

    if (payload?.type === 'super_admin') {
      next(new AppError('Super admin tokens are not valid on staff routes', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
      return;
    }
    if (payload?.type === 'candidate') {
      next(new AppError('Candidate tokens are not valid on staff routes', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
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
      next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
      return;
    }

    if (tenant.status === 'suspended') {
      next(new AppError('This account has been suspended. Contact support.', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
      return;
    }

    next();
  } catch {
    next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
  }
};
