import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyCandidateAccessToken } from '../auth/candidate.jwt';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { prisma } from '../../config/prisma';

export const authenticateCandidate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError('Missing or invalid authorization header', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyCandidateAccessToken(token) as any;
    if (payload?.type === 'candidate') {
      req.candidate = { candidateId: payload.sub, tenantId: payload.tenantId };
      next();
      return;
    }

    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: { name: 'candidate' },
      },
    });

    if (userRole) {
      req.candidate = { candidateId: payload.sub, tenantId: payload.tenantId };
      next();
      return;
    }

    next(new AppError('Staff tokens are not valid on candidate routes', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
  } catch {
    next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
  }
};

