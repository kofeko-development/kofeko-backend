import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

type SuperAdminJwtPayload = {
  role: 'superadmin';
  username: string;
};

export const signSuperAdminToken = (username: string): string => {
  return jwt.sign({ role: 'superadmin', username }, env.JWT_ACCESS_SECRET, { expiresIn: '8h' });
};

export const verifySuperAdminToken = (token: string): SuperAdminJwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as SuperAdminJwtPayload;
};
