import { systemRepository } from '../../repositories/system/system.repository';
import { sendEmail } from '../../common/email/emailProvider';

interface ContactInquiryData {
  name: string;
  email: string;
  companyName?: string;
  message: string;
}

export const systemService = {
  async getSeedStatus() {
    return systemRepository.getSeedStatus();
  },

  async processContactInquiry(data: ContactInquiryData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Company:</strong> ${data.companyName || 'N/A'}</p>
        <h3 style="margin-top: 20px;">Message:</h3>
        <p style="background: #f3f4f6; padding: 15px; border-radius: 8px; white-space: pre-wrap;">${data.message}</p>
      </div>
    `;

    await sendEmail({
      to: 'chirag@kofeko.com',
      subject: `New Inquiry from ${data.name} ${data.companyName ? `(${data.companyName})` : ''}`,
      html,
    });
  }
};
