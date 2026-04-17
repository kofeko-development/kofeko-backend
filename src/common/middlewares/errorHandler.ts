import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { env } from '../../config/env';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';
  let errorCode: string = ERROR_CODES.INTERNAL_SERVER_ERROR;
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.errorCode;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    details = error.flatten();
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    statusCode = StatusCodes.CONFLICT;
    message = 'Duplicate value violates unique constraint';
    errorCode = ERROR_CODES.CONFLICT;
    details = error.meta;
  } else if (error instanceof Error) {
    message = error.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV !== 'production' && error instanceof Error ? { stack: error.stack } : {}),
  });
};
