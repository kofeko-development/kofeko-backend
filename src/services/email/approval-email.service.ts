import { env } from '../../config/env';
import { sendEmail } from '../../common/email/emailProvider';

type SendApprovalEmailInput = {
  companyName: string;
  toEmail: string;
  tenantSlug: string;
  username: string;
  /** Omitted when the admin chose their password at registration (not echoed by email). */
  password?: string;
};

export const sendCompanyApprovalEmail = async (input: SendApprovalEmailInput): Promise<boolean> => {
  const loginUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/company-login`;
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

  await sendEmail({
    to: input.toEmail,
    subject,
    html,
  });

  return true;
};

type SendRejectionEmailInput = {
  companyName: string;
  toEmail: string;
  reason: string;
};

export const sendCompanyRejectionEmail = async (input: SendRejectionEmailInput): Promise<boolean> => {
  const subject = `Kofeko Registration Application Status - ${input.companyName}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px; color: #e11d48;">Company Registration Application Update</h2>
      <p style="margin-top: 0;">Hello ${input.companyName} team,</p>
      <p>Thank you for your interest in Kofeko. We have carefully reviewed your company registration request, but unfortunately, we are unable to approve your account at this time.</p>

      <div style="border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; background: #fff1f2; margin: 16px 0; color: #9f1239;">
        <p style="margin: 0; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Reason for Rejection / Review Remarks:</p>
        <p style="margin: 8px 0 0 0; font-size: 15px; line-height: 1.5;">${input.reason || 'No specific review notes provided.'}</p>
      </div>

      <p>If you believe this decision was made in error or if you have resolved the issues outlined above, please feel free to contact our support team or submit a new registration request with updated information.</p>
      <p style="margin-top: 24px;">Thank you,<br/>The Kofeko Team</p>
    </div>
  `;

  await sendEmail({
    to: input.toEmail,
    subject,
    html,
  });

  return true;
};

