import nodemailer from 'nodemailer';
import { env } from '../../config/env';

type SendApprovalEmailInput = {
  companyName: string;
  toEmail: string;
  tenantSlug: string;
  username: string;
  /** Omitted when the admin chose their password at registration (not echoed by email). */
  password?: string;
};

const getTransporter = () => {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

export const sendCompanyApprovalEmail = async (input: SendApprovalEmailInput): Promise<boolean> => {
  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }

  const loginUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/login`;
  const subject = `Kofeko Company Account Approved - ${input.companyName}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">Your Company Registration is Approved</h2>
      <p style="margin-top: 0;">Hello ${input.companyName} team,</p>
      <p>Your request has been approved by Kofeko Superadmin. Please use the credentials below to log in:</p>

      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb; margin: 16px 0;">
        <p style="margin: 6px 0;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="margin: 6px 0;"><strong>Tenant Slug:</strong> ${input.tenantSlug}</p>
        <p style="margin: 6px 0;"><strong>Username (Email):</strong> ${input.username}</p>
        ${
          input.password
            ? `<p style="margin: 6px 0;"><strong>Password:</strong> ${input.password}</p>`
            : `<p style="margin: 6px 0;"><strong>Password:</strong> Use the password you created when you submitted your company registration.</p>`
        }
      </div>

      <p>Sign in with your email and password using the tenant slug above.</p>
      <p style="margin-top: 24px;">Thanks,<br/>Kofeko Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: input.toEmail,
    subject,
    html,
  });

  return true;
};
