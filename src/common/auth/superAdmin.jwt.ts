import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type SuperAdminJwtPayload = {
  sub: string;
  type: 'super_admin';
  iat?: number;
  exp?: number;
};

const accessTokenExpiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'];
const refreshTokenExpiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export const signSuperAdminAccessToken = (payload: Omit<SuperAdminJwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessTokenExpiresIn });
};

export const signSuperAdminRefreshToken = (payload: Omit<SuperAdminJwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshTokenExpiresIn });
};

export const verifySuperAdminAccessToken = (token: string): SuperAdminJwtPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as SuperAdminJwtPayload;
  return decoded;
};

export const verifySuperAdminRefreshToken = (token: string): SuperAdminJwtPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as SuperAdminJwtPayload;
  return decoded;
};

