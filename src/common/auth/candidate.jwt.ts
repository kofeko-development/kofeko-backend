import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type CandidateJwtPayload = {
  sub: string;
  tenantId: string;
  type: 'candidate';
  iat?: number;
  exp?: number;
};

const accessTokenExpiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'];
const refreshTokenExpiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export const signCandidateAccessToken = (payload: Omit<CandidateJwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessTokenExpiresIn });
};

export const signCandidateRefreshToken = (payload: Omit<CandidateJwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshTokenExpiresIn });
};

export const verifyCandidateAccessToken = (token: string): CandidateJwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as CandidateJwtPayload;
};

export const verifyCandidateRefreshToken = (token: string): CandidateJwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as CandidateJwtPayload;
};

