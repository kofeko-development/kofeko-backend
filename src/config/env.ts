import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Prisma `directUrl` expects DIRECT_URL; for local Postgres use the same URI as DATABASE_URL.
if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  // Backwards-compatible overrides (optional)
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SUPERADMIN_USERNAME: z.string().default('superadmin@123'),
  SUPERADMIN_PASSWORD: z.string().default('kofeko_123'),
  SUPER_ADMIN_SETUP_KEY: z.string().default('dev-superadmin-setup-key'),
  APP_FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  /** Public base URL of this API (no trailing path). Used for proxied upload URLs. */
  API_PUBLIC_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('Kofeko'),
  SMTP_FROM_EMAIL: z.string().default('no-reply@kofeko.com'),

  /** When set, outbound mail uses Resend instead of SMTP (see `src/common/email/emailProvider.ts`). */
  RESEND_API_KEY: z.string().optional(),
  /** Resend "from" (verified domain or onboarding@resend.dev for tests). Falls back to SMTP_FROM. */
  RESEND_FROM: z.string().optional(),

  STORAGE_PROVIDER: z.enum(['local', 'supabase', 'firebase']).default('local'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_MODEL: z.string().optional(),
  REPLICATE_REASONING_EFFORT: z.enum(['none', 'low', 'medium', 'high', 'xhigh']).optional(),
  REPLICATE_VERBOSITY: z.enum(['low', 'medium', 'high']).optional(),
  REPLICATE_MAX_COMPLETION_TOKENS: z.string().optional(),

  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_ENCRYPT_KEY: z.string().min(32).optional(),
  /** General-purpose AES key for app secrets (2FA, etc.). Falls back to LINKEDIN_ENCRYPT_KEY. */
  APP_ENCRYPT_KEY: z.string().min(32).optional(),
  /** Set true only after LinkedIn approves w_organization_social on your app (Marketing API). */
  LINKEDIN_REQUEST_ORG_SCOPES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /** Redis URL for session profile + API response cache (optional — falls back to in-memory). */
  REDIS_URL: z.string().url().optional(),
  /** Session/auth cache TTL (seconds). */
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /** List/read API cache TTL (seconds). */
  CACHE_LIST_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  /** Company profile, integrations status, etc. (seconds). */
  CACHE_STATIC_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment variables: ${parsed.error.message}`);
  process.exit(1);
}

// const requireInProduction = (key: string, value: unknown, missing: string[]) => {
//   if (!parsed.success) return;
//   if (parsed.data.NODE_ENV !== 'production') return;
//   if (typeof value === 'string') {
//     if (!value.trim()) missing.push(key);
//     return;
//   }
//   if (value == null) missing.push(key);
// };

const missing: string[] = [];

const hasResend = Boolean(parsed.data.RESEND_API_KEY?.trim());
if (!hasResend) {
  // requireInProduction('SMTP_HOST', parsed.data.SMTP_HOST, missing);
  // requireInProduction('SMTP_PORT', parsed.data.SMTP_PORT, missing);
  // requireInProduction('SMTP_USER', parsed.data.SMTP_USER, missing);
  // requireInProduction('SMTP_PASS', parsed.data.SMTP_PASS, missing);
  // requireInProduction('SMTP_FROM', parsed.data.SMTP_FROM, missing);
} else {
  // requireInProduction('RESEND_API_KEY', parsed.data.RESEND_API_KEY, missing);
}
// requireInProduction('REPLICATE_API_TOKEN', parsed.data.REPLICATE_API_TOKEN, missing);
// requireInProduction('SUPER_ADMIN_SETUP_KEY', parsed.data.SUPER_ADMIN_SETUP_KEY, missing);
// requireInProduction('APP_FRONTEND_URL', parsed.data.APP_FRONTEND_URL, missing);

if (parsed.data.STORAGE_PROVIDER === 'firebase') {
  const firebaseMissing: string[] = [];
  const requireFirebase = (key: string, value: unknown) => {
    if (typeof value === 'string') {
      if (!value.trim()) firebaseMissing.push(key);
      return;
    }
    if (value == null) firebaseMissing.push(key);
  };
  requireFirebase('FIREBASE_PROJECT_ID', parsed.data.FIREBASE_PROJECT_ID);
  requireFirebase('FIREBASE_PRIVATE_KEY', parsed.data.FIREBASE_PRIVATE_KEY);
  requireFirebase('FIREBASE_CLIENT_EMAIL', parsed.data.FIREBASE_CLIENT_EMAIL);
  requireFirebase('FIREBASE_STORAGE_BUCKET', parsed.data.FIREBASE_STORAGE_BUCKET);

  if (firebaseMissing.length) {
    if (parsed.data.NODE_ENV === 'production') {
      console.error(`Missing required Firebase env vars for STORAGE_PROVIDER=firebase: ${firebaseMissing.join(', ')}`);
      process.exit(1);
    }
    console.warn(
      `[env] STORAGE_PROVIDER=firebase but missing: ${firebaseMissing.join(', ')} — file uploads will fail until these are set.`,
    );
  }
}

if (parsed.data.STORAGE_PROVIDER === 'supabase') {
  const supabaseMissing: string[] = [];
  const requireSupabase = (key: string, value: unknown) => {
    if (typeof value === 'string') {
      if (!value.trim()) supabaseMissing.push(key);
      return;
    }
    if (value == null) supabaseMissing.push(key);
  };

  requireSupabase('SUPABASE_URL', parsed.data.SUPABASE_URL);
  requireSupabase('SUPABASE_SERVICE_ROLE_KEY', parsed.data.SUPABASE_SERVICE_ROLE_KEY);
  requireSupabase('SUPABASE_STORAGE_BUCKET', parsed.data.SUPABASE_STORAGE_BUCKET);

  if (supabaseMissing.length) {
    console.error(`Missing required Supabase env vars for STORAGE_PROVIDER=supabase: ${supabaseMissing.join(', ')}`);
    process.exit(1);
  }
}

if (missing.length) {
  console.error(`Missing required environment variables for production: ${missing.join(', ')}`);
  process.exit(1);
}

const resolvedSmtpFrom = parsed.data.SMTP_FROM ?? `${parsed.data.SMTP_FROM_NAME} <${parsed.data.SMTP_FROM_EMAIL}>`;

/** Resend-provided test sender (no domain setup). Used in development when RESEND_API_KEY is set but RESEND_FROM is empty. */
const RESEND_DEV_SANDBOX_FROM = 'Kofeko <onboarding@resend.dev>';

const resendFromExplicit = parsed.data.RESEND_FROM?.trim();
const useDevResendDefault =
  hasResend &&
  !resendFromExplicit &&
  parsed.data.NODE_ENV === 'development';

export const env = {
  ...parsed.data,
  JWT_ACCESS_SECRET: parsed.data.JWT_ACCESS_SECRET ?? parsed.data.JWT_SECRET,
  JWT_REFRESH_SECRET: parsed.data.JWT_REFRESH_SECRET ?? parsed.data.JWT_SECRET,
  FRONTEND_URL: parsed.data.FRONTEND_URL ?? parsed.data.APP_FRONTEND_URL,
  API_PUBLIC_URL:
    parsed.data.API_PUBLIC_URL ??
    `http://localhost:${parsed.data.PORT}`,
  SMTP_FROM: resolvedSmtpFrom,
  /** Effective From header when using Resend. In local `development`, defaults to onboarding@resend.dev if RESEND_FROM is unset. */
  RESEND_EFFECTIVE_FROM: (resendFromExplicit || (useDevResendDefault ? RESEND_DEV_SANDBOX_FROM : resolvedSmtpFrom)).trim(),
};
