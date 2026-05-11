export type InviteEmailInput = {
  inviteLink: string;
  invitedUserName: string;
  /** Recruiter login email (same as To address). */
  inviteeEmail: string;
  tenantName?: string;
  tenantSlug?: string;
  loginUrl: string;
  /** One-time password until they change it via the link below. */
  temporaryPassword: string;
  position?: string | null;
};

export function inviteEmailTemplate(input: InviteEmailInput): string {
  const tenantLine = input.tenantName ? `<p><strong>Workspace:</strong> ${input.tenantName}</p>` : '';
  const slugLine = input.tenantSlug
    ? `<p><strong>Company slug (for login, if asked):</strong> <code>${input.tenantSlug}</code></p>`
    : '';
  const positionLine = input.position?.trim()
    ? `<p><strong>Your position:</strong> ${input.position.trim()}</p>`
    : '';

  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 640px">
    <h2>You’ve been invited to Kofeko</h2>
    <p>Hi ${input.invitedUserName},</p>
    ${tenantLine}
    ${slugLine}
    ${positionLine}
    <p>Your company has added you as a recruiter. Use <strong>your own email address</strong> below to sign in (not the company’s general contact email).</p>

    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#f9fafb;margin:16px 0">
      <p style="margin:6px 0"><strong>Login URL:</strong> <a href="${input.loginUrl}">${input.loginUrl}</a></p>
      <p style="margin:6px 0"><strong>Email:</strong> ${input.inviteeEmail}</p>
      <p style="margin:6px 0"><strong>Temporary password:</strong> <code style="font-size:15px;background:#fff;padding:2px 6px;border:1px solid #e5e7eb;border-radius:4px">${input.temporaryPassword}</code></p>
    </div>
    <p style="color:#374151;font-size:14px">Sign in with the email and temporary password above. If the login form asks for a company slug, use the value shown earlier.</p>

    <p>You can replace the temporary password using this link:</p>
    <p>
      <a href="${input.inviteLink}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">
        Set a new password
      </a>
    </p>
    <p>If you didn’t expect this invitation, you can ignore this email.</p>
    <hr />
    <p style="color:#6b7280;font-size:12px">Kofeko — AI-powered hiring platform</p>
  </div>
  `;
}
