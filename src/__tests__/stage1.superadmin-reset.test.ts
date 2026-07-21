/// <reference types="jest" />
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { hashPassword } from '../common/auth/password';

jest.mock('../common/email/emailProvider', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.setTimeout(30000);

const { sendEmail } = jest.requireMock('../common/email/emailProvider') as {
  sendEmail: jest.Mock;
};

function extractTokenFromHtml(html: string): string {
  const match = html.match(/token=([a-f0-9]{20,})/i);
  if (!match) {
    throw new Error('No token found in email html');
  }
  return match[1];
}

describe('Superadmin forgot/reset password', () => {
  const email = 'reset-super@test.local';
  const originalPassword = 'SuperAdminA1aaaa';
  const newPassword = 'NewSuper1';

  beforeEach(async () => {
    sendEmail.mockClear();
    await prisma.superAdmin.create({
      data: {
        email,
        passwordHash: await hashPassword(originalPassword),
        firstName: 'Reset',
        lastName: 'Admin',
      },
    });
  });

  it('forgot-password always returns 200', async () => {
    const known = await request(app).post('/api/v1/superadmin/auth/forgot-password').send({ email });
    expect(known.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    sendEmail.mockClear();
    const unknown = await request(app)
      .post('/api/v1/superadmin/auth/forgot-password')
      .send({ email: 'missing@test.local' });
    expect(unknown.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends reset email for existing superadmin and resets password', async () => {
    const forgotRes = await request(app).post('/api/v1/superadmin/auth/forgot-password').send({ email });
    expect(forgotRes.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const sent = sendEmail.mock.calls[0][0] as { html: string };
    const rawToken = extractTokenFromHtml(sent.html);

    const resetRes = await request(app).post('/api/v1/superadmin/auth/reset-password').send({
      token: rawToken,
      password: newPassword,
    });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/v1/superadmin/auth/login').send({
      email,
      password: newPassword,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
  });

  it('rejects expired reset token', async () => {
    const forgotRes = await request(app).post('/api/v1/superadmin/auth/forgot-password').send({ email });
    expect(forgotRes.status).toBe(200);

    const sent = sendEmail.mock.calls[0][0] as { html: string };
    const rawToken = extractTokenFromHtml(sent.html);

    const tokenRow = await prisma.superAdminPasswordResetToken.findFirst({
      where: { superAdmin: { email } },
      orderBy: { createdAt: 'desc' },
    });
    expect(tokenRow).toBeTruthy();

    await prisma.superAdminPasswordResetToken.update({
      where: { id: tokenRow!.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const resetRes = await request(app).post('/api/v1/superadmin/auth/reset-password').send({
      token: rawToken,
      password: 'Another1Pass',
    });
    expect(resetRes.status).toBe(400);
    expect(resetRes.body.errorCode).toBe('RESET_TOKEN_EXPIRED');
  });
});
