import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import {
  COMPANY_REGISTRATION_EMAIL_JWT_TYP,
  CompanyRegistrationEmailJwtPayload,
  JwtPayloadData,
} from '../../types/auth/auth.types';

export const CANDIDATE_PHONE_VERIFICATION_JWT_TYP = 'kofeko.candidate-phone-verification.v1';
export interface CandidatePhoneVerificationJwtPayload {
  typ: typeof CANDIDATE_PHONE_VERIFICATION_JWT_TYP;
  phoneNumber: string;
}

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

export const signCompanyRegistrationEmailToken = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  return jwt.sign(
    { typ: COMPANY_REGISTRATION_EMAIL_JWT_TYP, email: normalized } satisfies CompanyRegistrationEmailJwtPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: '30m' },
  );
};

export const verifyCompanyRegistrationEmailToken = (token: string): CompanyRegistrationEmailJwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & Partial<CompanyRegistrationEmailJwtPayload>;
    if (decoded.typ !== COMPANY_REGISTRATION_EMAIL_JWT_TYP || typeof decoded.email !== 'string' || !decoded.email.trim()) {
      throw new AppError('Invalid email verification token', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return { typ: COMPANY_REGISTRATION_EMAIL_JWT_TYP, email: decoded.email.trim().toLowerCase() };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired email verification', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
};

export const signCandidatePhoneVerificationToken = (phoneNumber: string): string => {
  const normalized = phoneNumber.trim();
  return jwt.sign(
    { typ: CANDIDATE_PHONE_VERIFICATION_JWT_TYP, phoneNumber: normalized } satisfies CandidatePhoneVerificationJwtPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: '30m' },
  );
};

export const verifyCandidatePhoneVerificationToken = (token: string): CandidatePhoneVerificationJwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & Partial<CandidatePhoneVerificationJwtPayload>;
    if (decoded.typ !== CANDIDATE_PHONE_VERIFICATION_JWT_TYP || typeof decoded.phoneNumber !== 'string' || !decoded.phoneNumber.trim()) {
      throw new AppError('Invalid phone verification token', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return { typ: CANDIDATE_PHONE_VERIFICATION_JWT_TYP, phoneNumber: decoded.phoneNumber.trim() };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired phone verification', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
};

export const CANDIDATE_SIGNUP_EMAIL_JWT_TYP = 'kofeko.candidate-signup-email.v1';
export interface CandidateSignupEmailJwtPayload {
  typ: typeof CANDIDATE_SIGNUP_EMAIL_JWT_TYP;
  email: string;
}

export const signCandidateSignupEmailToken = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  return jwt.sign(
    { typ: CANDIDATE_SIGNUP_EMAIL_JWT_TYP, email: normalized } satisfies CandidateSignupEmailJwtPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: '30m' },
  );
};

export const verifyCandidateSignupEmailToken = (token: string): CandidateSignupEmailJwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & Partial<CandidateSignupEmailJwtPayload>;
    if (decoded.typ !== CANDIDATE_SIGNUP_EMAIL_JWT_TYP || typeof decoded.email !== 'string' || !decoded.email.trim()) {
      throw new AppError('Invalid candidate email verification token', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return { typ: CANDIDATE_SIGNUP_EMAIL_JWT_TYP, email: decoded.email.trim().toLowerCase() };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired candidate email verification', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
};
