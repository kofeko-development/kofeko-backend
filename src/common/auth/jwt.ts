import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtPayloadData } from '../../types/auth/auth.types';

const accessTokenExpiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'];
const refreshTokenExpiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export const signAccessToken = (payload: JwtPayloadData): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessTokenExpiresIn });
};

export const signRefreshToken = (payload: JwtPayloadData): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshTokenExpiresIn });
};

export const verifyAccessToken = (token: string): JwtPayloadData => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayloadData;
};

export const verifyRefreshToken = (token: string): JwtPayloadData => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayloadData;
};
