import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { logger } from '../logger/logger';

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
    if (statusCode >= 500) {
      logger.error({ err: error, errorCode, statusCode }, 'Application error');
    } else {
      logger.warn({ errorCode, statusCode, message }, 'Client error');
    }
  } else if (error instanceof ZodError) {
    logger.warn({ errorCode: ERROR_CODES.VALIDATION_ERROR }, 'Validation error');
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    details = error.flatten();
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    logger.warn({ errorCode: ERROR_CODES.CONFLICT }, 'Conflict');
    statusCode = StatusCodes.CONFLICT;
    message = 'Duplicate value violates unique constraint';
    errorCode = ERROR_CODES.CONFLICT;
    details = error.meta;
  } else if (error instanceof Error) {
    logger.error({ err: error }, 'Unhandled error');
    message = error.message;
  } else {
    logger.error({ err: error }, 'Unhandled error');
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    statusCode,
    ...(details ? { details } : {}),
  });
};
