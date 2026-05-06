import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmail(input: SendEmailInput): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } catch (error) {
    throw new AppError('Failed to send email', 502, ERROR_CODES.INTERNAL_SERVER_ERROR, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
