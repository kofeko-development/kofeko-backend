export function rejectionEmail(data: {
  candidateName: string;
  jobTitle: string;
  companyName: string;
}): { subject: string; html: string } {
  const subject = `Your application for ${data.jobTitle} at ${data.companyName}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:18px 22px;background:#111827;color:#ffffff;font-size:16px;font-weight:bold;">
                ${data.companyName}
              </td>
            </tr>
            <tr>
              <td style="padding:22px;color:#111827;font-size:14px;line-height:1.5;">
                <p style="margin:0 0 12px 0;">Hi ${data.candidateName},</p>
                <p style="margin:0 0 12px 0;">
                  Thank you for your interest in the <strong>${data.jobTitle}</strong> role at <strong>${data.companyName}</strong>.
                </p>
                <p style="margin:0 0 16px 0;">
                  After careful consideration, we won’t be moving forward at this time. We appreciate the time you invested in applying.
                </p>
                <p style="margin:0;">Sincerely,<br/>${data.companyName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 22px;background:#f3f4f6;color:#6b7280;font-size:12px;line-height:1.4;">
                This email was sent by Kofeko Hiring Platform
                <!-- unsubscribe -->
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

