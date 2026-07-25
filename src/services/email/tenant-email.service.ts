import { sendEmail } from '../../common/email/emailProvider';

type SendTenantStatusEmailInput = {
  companyName: string;
  toEmail: string;
  status: 'restricted' | 'deleted';
  reason: string;
  days?: number;
};

export const sendTenantStatusEmail = async (input: SendTenantStatusEmailInput): Promise<boolean> => {
  const isDeleted = input.status === 'deleted';
  const subject = isDeleted
    ? `URGENT: Kofeko Company Account Disabled - ${input.companyName}`
    : `NOTICE: Kofeko Company Account Temporarily Restricted - ${input.companyName}`;

  const restrictionDetails = !isDeleted && input.days
    ? `<p style="margin: 6px 0;"><strong>Restriction Period:</strong> ${input.days} days</p>`
    : '';

  const actionText = isDeleted
    ? `<p style="color: #b91c1c; font-weight: bold;">Your company account and all associated data have been permanently disabled by Kofeko administration.</p>`
    : `<p style="color: #b45309; font-weight: bold;">Your company account has been temporarily restricted by Kofeko administration.</p>`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">Important Account Notice</h2>
      <p style="margin-top: 0;">Hello ${input.companyName} team,</p>
      ${actionText}
      
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb; margin: 16px 0;">
        <p style="margin: 6px 0;"><strong>Reason:</strong> ${input.reason}</p>
        ${restrictionDetails}
      </div>

      <p>If you believe this action was taken in error, please contact Kofeko Support immediately.</p>
      <p style="margin-top: 24px;">Thanks,<br/>Kofeko Security Team</p>
    </div>
  `;

  await sendEmail({
    to: input.toEmail,
    subject,
    html,
  });

  return true;
};
