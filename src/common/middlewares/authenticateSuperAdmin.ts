import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifySuperAdminToken } from '../auth/superadminJwt';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const authenticateSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authorization token is missing', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  const token = authHeader.split(' ')[1];
  const payload = verifySuperAdminToken(token);
  if (payload.role !== 'superadmin') {
    throw new AppError('Unauthorized', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  next();
};
