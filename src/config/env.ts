import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SUPERADMIN_USERNAME: z.string().default('superadmin@123'),
  SUPERADMIN_PASSWORD: z.string().default('kofeko_123'),
  APP_FRONTEND_URL: z.string().url().default('http://localhost:3000'),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  FRONTEND_URL: parsed.data.FRONTEND_URL ?? parsed.data.APP_FRONTEND_URL,
  SMTP_FROM: parsed.data.SMTP_FROM ?? `${parsed.data.SMTP_FROM_NAME} <${parsed.data.SMTP_FROM_EMAIL}>`,
};
