import { Request } from 'express';

export const getRequestBody = <T>(req: Request): T => req.body as T;