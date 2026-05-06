type PasswordResetEmailInput = {
  resetLink: string;
  userName: string;
  tenantName?: string;
};

export function passwordResetEmailTemplate(input: PasswordResetEmailInput): string {
  const tenantLine = input.tenantName ? `<p><strong>Workspace:</strong> ${input.tenantName}</p>` : '';

  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.5">
    <h2>Reset your Kofeko password</h2>
    <p>Hi ${input.userName},</p>
    ${tenantLine}
    <p>Click the button below to reset your password. This link expires in 1 hour.</p>
    <p>
      <a href="${input.resetLink}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">
        Reset Password
      </a>
    </p>
    <p>If you didn’t request a password reset, you can ignore this email.</p>
    <hr />
    <p style="color:#6b7280;font-size:12px">Kofeko — AI-powered hiring platform</p>
  </div>
  `;
}
