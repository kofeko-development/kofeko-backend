import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { verifyAccessToken } from '../auth/jwt';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError('Missing or invalid authorization header', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
    };
    next();
  } catch {
    next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
  }
};
