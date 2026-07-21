import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ERROR_CODES, getErrorCategory } from '../errors/errorCodes';
import { ERROR_CATEGORIES, type ErrorCategory } from '../errors/errorCategories';
import { logger } from '../logger/logger';
import { zodErrorDetails } from '../utils/zodErrorDetails';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';
  let errorCode: string = ERROR_CODES.INTERNAL_SERVER_ERROR;
  let errorCategory: ErrorCategory = ERROR_CATEGORIES.SERVER;
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.errorCode;
    errorCategory = error.errorCategory;
    details = error.details;
    if (statusCode >= 500) {
      logger.error({ err: error, errorCode, errorCategory, statusCode }, 'Application error');
    } else {
      logger.warn({ errorCode, errorCategory, statusCode, message }, 'Client error');
    }
  } else if (error instanceof ZodError) {
    logger.warn({ errorCode: ERROR_CODES.VALIDATION_ERROR }, 'Validation error');
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    errorCategory = ERROR_CATEGORIES.VALIDATION;
    details = zodErrorDetails(error);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    logger.warn({ errorCode: ERROR_CODES.CONFLICT }, 'Conflict');
    statusCode = StatusCodes.CONFLICT;
    message = 'Duplicate value violates unique constraint';
    errorCode = ERROR_CODES.CONFLICT;
    errorCategory = ERROR_CATEGORIES.BUSINESS;
    details = error.meta;
  } else if (error instanceof Error) {
    logger.error({ err: error }, 'Unhandled error');
    message = error.message;
    errorCategory = ERROR_CATEGORIES.SERVER;
  } else {
    logger.error({ err: error }, 'Unhandled error');
  }

  if (!(error instanceof AppError) && !(error instanceof ZodError)) {
    errorCategory = getErrorCategory(errorCode, statusCode);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    errorCategory,
    statusCode,
    ...(details ? { details } : {}),
  });
};
