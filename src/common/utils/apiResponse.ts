import { Response } from 'express';

type SuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export const sendSuccess = <T>(res: Response, statusCode: number, message: string, data: T, meta?: Record<string, unknown>) => {
  const payload: SuccessResponse<T> = {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };

  return res.status(statusCode).json(payload);
};
