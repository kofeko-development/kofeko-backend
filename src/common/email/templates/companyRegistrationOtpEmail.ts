export function companyRegistrationOtpEmailTemplate(input: { code: string; recipientName?: string }): string {
  const greeting = input.recipientName?.trim() ? `Hi ${input.recipientName.trim()},` : 'Hi,';

  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 560px">
    <h2 style="margin-bottom: 12px">Verify your email for Kofeko company registration</h2>
    <p>${greeting}</p>
    <p>Use this one-time code to verify your company admin email. It expires in <strong>1 minute</strong>.</p>
    <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 24px 0">${input.code}</p>
    <p style="color:#6b7280;font-size:13px">If you did not start a company registration, you can ignore this message.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="color:#6b7280;font-size:12px">Kofeko — AI-powered hiring platform</p>
  </div>
  `;
}
