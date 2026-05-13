import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

function createTransport() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new AppError(`Missing required email configuration: ${key}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.EMAIL_FAILED);
    }
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendViaResend(options: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError('RESEND_API_KEY is not configured', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.EMAIL_FAILED);
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: env.RESEND_EFFECTIVE_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    const base = typeof error.message === 'string' ? error.message : 'Resend rejected the email';
    const hint =
      base.includes('domain is not verified') || base.includes('invalid_from')
        ? ` Current "from" is "${env.RESEND_EFFECTIVE_FROM}". Set RESEND_FROM to a Resend-allowed sender (e.g. onboarding@resend.dev) or verify your domain at https://resend.com/domains — you cannot use @gmail.com / personal domains as the sender.`
        : '';
    throw new AppError(base + hint, StatusCodes.BAD_REQUEST, ERROR_CODES.EMAIL_FAILED);
  }
}

async function sendViaSmtp(options: { to: string; subject: string; html: string }): Promise<void> {
  const transporter = createTransport();
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('ECONNREFUSED')) {
      const host = process.env.SMTP_HOST ?? '';
      const port = process.env.SMTP_PORT ?? '';
      throw new AppError(
        `Cannot connect to SMTP at ${host}:${port}. Nothing is listening (common with MailHog/Mailpit on port 1025). Start your local mail server, set RESEND_API_KEY to use Resend, or point SMTP_* to a real provider.`,
        StatusCodes.SERVICE_UNAVAILABLE,
        ERROR_CODES.EMAIL_FAILED,
      );
    }
    throw new AppError(msg, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.EMAIL_FAILED);
  }
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (env.RESEND_API_KEY?.trim()) {
    try {
      await sendViaResend(options);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        throw new AppError(
          'Could not reach Resend API. Check RESEND_API_KEY and network.',
          StatusCodes.SERVICE_UNAVAILABLE,
          ERROR_CODES.EMAIL_FAILED,
        );
      }
      throw new AppError(msg, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.EMAIL_FAILED);
    }
    return;
  }

  await sendViaSmtp(options);
}
