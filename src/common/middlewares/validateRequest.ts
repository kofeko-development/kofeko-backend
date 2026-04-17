import { ZodError, ZodTypeAny } from 'zod';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const validateRequest = (schema: ZodTypeAny): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse({ body: req.body, params: req.params, query: req.query });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError('Validation failed', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, error.flatten()));
        return;
      }
      next(error);
    }
  };
};
