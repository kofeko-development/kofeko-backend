import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

jest.mock('../common/email/emailProvider', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

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

describe('Stage 1: invite + accept-invite + password reset', () => {
  it('invites a user, stores invite token, sends email, accepts invite, and user can login', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@acme.com',
      password: 'AdminA1aaaa',
    });

    expect(registerRes.status).toBe(201);
    const { accessToken, tenant } = registerRes.body.data;

    const inviteRes = await request(app)
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Invited',
        lastName: 'Person',
        email: 'invited@acme.com',
        roleName: 'recruiter',
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.email).toBe('invited@acme.com');
    expect(inviteRes.body.data.passwordHash).toBeUndefined();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(sent.to).toBe('invited@acme.com');

    const rawInviteToken = extractTokenFromHtml(sent.html);

    const inviteTokenRow = await prisma.inviteToken.findFirst({
      where: {
        tenantId: tenant.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(inviteTokenRow).toBeTruthy();
    expect(inviteTokenRow?.usedAt).toBeNull();

    const acceptRes = await request(app).post('/api/v1/auth/accept-invite').send({
      token: rawInviteToken,
      password: 'InvitedA1aaaa',
    });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe('active');

    const usedInvite = await prisma.inviteToken.findUnique({ where: { id: inviteTokenRow!.id } });
    expect(usedInvite?.usedAt).toBeTruthy();

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      tenantSlug: 'acme',
      email: 'invited@acme.com',
      password: 'InvitedA1aaaa',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
  });

  it('rejects expired invite token with 400', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@acme.com',
      password: 'AdminA1aaaa',
    });

    const { accessToken, tenant } = registerRes.body.data;

    await request(app)
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Invited',
        lastName: 'Person',
        email: 'invited@acme.com',
        roleName: 'recruiter',
      });

    const sent = sendEmail.mock.calls.at(-1)?.[0] as { html: string };
    const rawInviteToken = extractTokenFromHtml(sent.html);

    const inviteTokenRow = await prisma.inviteToken.findFirst({ where: { tenantId: tenant.id } });
    expect(inviteTokenRow).toBeTruthy();

    await prisma.inviteToken.update({
      where: { id: inviteTokenRow!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const acceptRes = await request(app).post('/api/v1/auth/accept-invite').send({
      token: rawInviteToken,
      password: 'InvitedA1aaaa',
    });

    expect(acceptRes.status).toBe(400);
  });

  it('forgot-password creates reset token and reset-password updates password', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@acme.com',
      password: 'AdminA1aaaa',
    });

    expect(registerRes.status).toBe(201);

    const forgotRes = await request(app).post('/api/v1/auth/forgot-password').send({
      tenantSlug: 'acme',
      email: 'admin@acme.com',
    });

    expect(forgotRes.status).toBe(200);
    const sent = sendEmail.mock.calls.at(-1)?.[0] as { html: string; to: string };
    expect(sent.to).toBe('admin@acme.com');

    const rawResetToken = extractTokenFromHtml(sent.html);

    const resetTokenRow = await prisma.passwordResetToken.findFirst({
      where: { tenant: { slug: 'acme' } },
      orderBy: { createdAt: 'desc' },
    });

    expect(resetTokenRow).toBeTruthy();
    expect(resetTokenRow?.usedAt).toBeNull();

    const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
      token: rawResetToken,
      password: 'AdminB2bbbb',
    });

    expect(resetRes.status).toBe(200);

    const usedReset = await prisma.passwordResetToken.findUnique({ where: { id: resetTokenRow!.id } });
    expect(usedReset?.usedAt).toBeTruthy();

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      tenantSlug: 'acme',
      email: 'admin@acme.com',
      password: 'AdminB2bbbb',
    });

    expect(loginRes.status).toBe(200);
  });
});
