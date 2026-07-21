import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifySuperAdminAccessToken } from '../auth/superAdmin.jwt';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

const SESSION_EXPIRED_MESSAGE = 'Session expired, please log in again';

export const authenticateSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError(SESSION_EXPIRED_MESSAGE, StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED));
    return;
  }

  const token = authHeader.split(' ')[1];
  let payload: any;
  try {
    payload = verifySuperAdminAccessToken(token) as any;
  } catch {
    next(new AppError(SESSION_EXPIRED_MESSAGE, StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED));
    return;
  }

  if (payload.type !== 'super_admin') {
    next(new AppError("You don't have permission to do this", StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
    return;
  }

  req.superAdmin = { superAdminId: payload.sub };

  next();
};
