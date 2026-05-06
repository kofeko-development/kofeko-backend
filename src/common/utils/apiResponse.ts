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

type PaginatedResponse<T> = {
  success: true;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export const sendPaginated = <T>(
  res: Response,
  statusCode: number,
  payload: { items: T[]; total: number; page: number; limit: number },
) => {
  const totalPages = Math.max(1, Math.ceil(payload.total / payload.limit));
  const body: PaginatedResponse<T> = {
    success: true,
    data: {
      items: payload.items,
      total: payload.total,
      page: payload.page,
      limit: payload.limit,
      totalPages,
    },
  };
  return res.status(statusCode).json(body);
};
