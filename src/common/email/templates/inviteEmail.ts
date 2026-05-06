type InviteEmailInput = {
  inviteLink: string;
  invitedUserName: string;
  tenantName?: string;
};

export function inviteEmailTemplate(input: InviteEmailInput): string {
  const tenantLine = input.tenantName ? `<p><strong>Workspace:</strong> ${input.tenantName}</p>` : '';

  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.5">
    <h2>You’ve been invited to Kofeko</h2>
    <p>Hi ${input.invitedUserName},</p>
    ${tenantLine}
    <p>Click the button below to accept your invite and set your password.</p>
    <p>
      <a href="${input.inviteLink}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">
        Accept Invite
      </a>
    </p>
    <p>If you didn’t expect this invitation, you can ignore this email.</p>
    <hr />
    <p style="color:#6b7280;font-size:12px">Kofeko — AI-powered hiring platform</p>
  </div>
  `;
}
