import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifySuperAdminAccessToken } from '../auth/superAdmin.jwt';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const authenticateSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authorization token is missing', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  const token = authHeader.split(' ')[1];
  let payload: any;
  try {
    payload = verifySuperAdminAccessToken(token) as any;
  } catch {
    throw new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  if (payload.type !== 'super_admin') {
    throw new AppError('Tenant tokens are not valid on super admin routes', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }

  req.superAdmin = { superAdminId: payload.sub };

  next();
};
