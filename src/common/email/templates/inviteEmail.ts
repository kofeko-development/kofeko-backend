import { escapeHtml } from '../htmlEscape';

export type InviteEmailInput = {
  inviteLink: string;
  invitedUserName: string;
  /** Recruiter login email (same as To address). */
  inviteeEmail: string;
  tenantName?: string;
  tenantSlug?: string;
  loginUrl: string;
  /** One-time password until they change it via the link below. */
  temporaryPassword?: string;
  /** Plain-text role label, e.g. "HR Manager" or custom position title. */
  roleTitle: string;
  /** Pre-rendered HTML block with responsibilities (already safe / from trusted templates). */
  responsibilitiesSectionHtml: string;
};

/** Primary purple aligned with app theme (~ hsl(271 33% 55%)). */
const BRAND_PRIMARY = '#7c5bb0';
const BRAND_PRIMARY_DARK = '#5f3d8a';

export function inviteEmailTemplate(input: InviteEmailInput): string {
  const name = escapeHtml(input.invitedUserName.trim() || 'there');
  const email = escapeHtml(input.inviteeEmail);
  const tenantLine = input.tenantName
    ? `<p style="margin:8px 0;color:#374151;font-size:14px"><strong>Workspace:</strong> ${escapeHtml(input.tenantName)}</p>`
    : '';
  const slugLine = input.tenantSlug
    ? `<p style="margin:8px 0;color:#374151;font-size:14px"><strong>Company slug</strong> (for login if asked): <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-size:13px">${escapeHtml(input.tenantSlug)}</code></p>`
    : '';
  const roleTitle = escapeHtml(input.roleTitle.trim() || 'team member');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;max-width:640px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_PRIMARY_DARK} 100%);color:#fff;padding:22px 24px;border-radius:10px 10px 0 0">
      <h1 style="margin:0;font-size:22px;font-weight:700">Welcome to Kofeko</h1>
      <p style="margin:10px 0 0;font-size:15px;opacity:0.95">Your team invited you to collaborate on hiring — here’s how to get started.</p>
    </div>
    <div style="padding:22px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;background:#ffffff">
      <p style="margin:0 0 16px;font-size:15px">Hi ${name},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151">
        You’ve been invited as <strong>${roleTitle}</strong>. Use <strong>your own work email</strong> (${email}) to sign in — not a shared or generic company inbox.
      </p>
      ${tenantLine}
      ${slugLine}

      ${input.responsibilitiesSectionHtml}

      <p style="margin:18px 0 10px;font-size:14px;color:#374151;font-weight:600">Your sign-in details</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;background:#f9fafb;margin:0 0 18px">
        <p style="margin:6px 0;font-size:14px"><strong>Email:</strong> ${email}</p>
      </div>
      <p style="margin:0 0 14px;color:#4b5563;font-size:14px">
        Please click the button below to accept your invitation and set up your password:
      </p>
      <p style="margin:0 0 8px">
        <a href="${escapeHtml(input.inviteLink)}" style="display:inline-block;padding:12px 20px;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Accept Invite
        </a>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280">
        If you didn’t expect this invitation, you can ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 14px" />
      <p style="margin:0;color:#9ca3af;font-size:12px">Kofeko — AI-powered hiring platform</p>
    </div>
  </div>
  `;
}

