export function candidateWelcomeEmail(data: {
  candidateName: string;
  companyName: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject = `Welcome to ${data.companyName}'s hiring portal`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hi ${data.candidateName},</p>
      <p>Welcome to <b>${data.companyName}</b>'s hiring portal.</p>
      <p>You can browse open roles, apply, and track your application status here:</p>
      <p><a href="${data.portalUrl}">${data.portalUrl}</a></p>
      <p>Thanks,<br/>${data.companyName} Hiring Team</p>
    </div>
  `;
  return { subject, html };
}

