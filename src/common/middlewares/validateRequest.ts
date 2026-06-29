import { ZodError, ZodTypeAny } from 'zod';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { zodErrorDetails } from '../utils/zodErrorDetails';

export const validateRequest = (schema: ZodTypeAny): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({ body: req.body, params: req.params, query: req.query }) as any;

      if (parsed.body) {
        req.body = parsed.body;
      }
      if (parsed.params) {
        for (const key in req.params) {
          delete req.params[key];
        }
        Object.assign(req.params, parsed.params);
      }
      if (parsed.query) {
        for (const key in req.query) {
          delete (req.query as any)[key];
        }
        Object.assign(req.query, parsed.query);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError('Validation failed', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, zodErrorDetails(error)));
        return;
      }
      next(error);
    }
  };
};
