export const ERROR_CODES = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Auth — credentials
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  WRONG_PORTAL: 'WRONG_PORTAL',               // NEW: tried to login on wrong portal type

  // Auth — account state
  APPROVAL_PENDING: 'APPROVAL_PENDING',        // NEW: company registration not yet approved
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',      // NEW: company registration was declined
  ACCOUNT_NO_PASSWORD: 'ACCOUNT_NO_PASSWORD',  // NEW: recruiter-created candidate has no password
  ACCOUNT_INVITED_ONLY: 'ACCOUNT_INVITED_ONLY',// NEW: staff invited but hasn't accepted yet
  USER_SUSPENDED: 'USER_SUSPENDED',            // NEW: individual user suspended (vs whole tenant)
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',        // existing: whole company suspended

  // Auth — tokens
  INVITE_TOKEN_EXPIRED: 'INVITE_TOKEN_EXPIRED',// NEW: invite token past 72hr expiry
  INVITE_TOKEN_USED: 'INVITE_TOKEN_USED',      // NEW: invite token already accepted
  INVITE_TOKEN_INVALID: 'INVITE_TOKEN_INVALID',// NEW: invite token not found
  RESET_TOKEN_EXPIRED: 'RESET_TOKEN_EXPIRED',  // NEW: password reset token expired
  RESET_TOKEN_USED: 'RESET_TOKEN_USED',        // NEW: password reset token already used
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',  // NEW: reset token not found
  OTP_EXPIRED: 'OTP_EXPIRED',                  // NEW: OTP code expired
  OTP_INVALID: 'OTP_INVALID',                  // NEW: OTP code wrong
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',        // NEW: too many OTP attempts
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',        // NEW: resend too soon

  // Access
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // Business rules
  JOB_NOT_OPEN: 'JOB_NOT_OPEN',               // NEW: job must be open for pipeline
  JOB_IS_CLOSED: 'JOB_IS_CLOSED',             // NEW: cannot edit/publish a closed job
  INVALID_STAGE_TRANSITION: 'INVALID_STAGE_TRANSITION',
  ALREADY_IN_PIPELINE: 'ALREADY_IN_PIPELINE',
  NO_RESUME: 'NO_RESUME',
  NO_SKILL_WEIGHTS: 'NO_SKILL_WEIGHTS',        // NEW: job has no skillWeights for AI eval

  // Infrastructure
  AI_EVALUATION_FAILED: 'AI_EVALUATION_FAILED',
  AI_PAYMENT_REQUIRED: 'AI_PAYMENT_REQUIRED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  EMAIL_FAILED: 'EMAIL_FAILED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
