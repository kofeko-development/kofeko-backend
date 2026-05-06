import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { sendEmail } from '../common/email/emailProvider';

jest.mock('../common/email/emailProvider', () => ({
  sendEmail: jest.fn(),
}));

describe('Stage 7: communication + emails', () => {
  const sendEmailMock = sendEmail as unknown as jest.Mock;

  beforeEach(() => {
    sendEmailMock.mockReset().mockResolvedValue(undefined);
  });

  it('advanceStage to screening sends stage advance email and persists sent rows', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage7-1',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage7-1@acme.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes.status).toBe(201);
    const { accessToken, tenant } = registerRes.body.data as {
      accessToken: string;
      tenant: { id: string };
    };

    // Create company so companyName is available
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        company: {
          create: {
            companyName: 'Acme Inc',
            companyAddress: {},
            industry: 'Software',
            companySize: '1-10',
            companyType: 'startup',
            foundedYear: 2020,
            companyWebsite: 'https://acme.example',
            officialCompanyAddress: 'Somewhere',
            companyLogo: 'logo',
            shortDescription: 'short',
            termsAccepted: true,
          },
        },
      },
    });

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some job description.' });
    expect(jobRes.status).toBe(201);
    const jobId = String(jobRes.body.data.id);
    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage7@acme.com' });
    expect(candidateRes.status).toBe(201);
    const candidateId = String(candidateRes.body.data.id);

    const pipelineRes = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(pipelineRes.status).toBe(201);
    const pipelineId = String(pipelineRes.body.data.id);

    const advanceRes = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/advance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stage: 'screening' });
    expect(advanceRes.status).toBe(200);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe('jane-stage7@acme.com');
    expect(String(sendEmailMock.mock.calls[0][0].subject)).toContain('Role');

    const msg = await prisma.message.findFirst({ where: { tenantId: tenant.id, type: 'stage_advance' } });
    expect(msg?.status).toBe('sent');

    const notif = await prisma.notification.findFirst({ where: { tenantId: tenant.id, type: 'stage_advance' } });
    expect(notif?.status).toBe('sent');

    // ensure other tenant isolation baseline
    const otherTenantMsgs = await prisma.message.findMany({ where: { tenantId: '00000000-0000-0000-0000-000000000000' } });
    expect(otherTenantMsgs.length).toBe(0);
  });

  it('advanceStage to offer uses offer template path (type=offer)', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage7-2',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage7-2@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        company: {
          create: {
            companyName: 'Acme Inc',
            companyAddress: {},
            industry: 'Software',
            companySize: '1-10',
            companyType: 'startup',
            foundedYear: 2020,
            companyWebsite: 'https://acme.example',
            officialCompanyAddress: 'Somewhere',
            companyLogo: 'logo',
            shortDescription: 'short',
            termsAccepted: true,
          },
        },
      },
    });

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some job description.' });
    const jobId = String(jobRes.body.data.id);
    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const cRes = await request(app).post('/api/v1/candidates').set('Authorization', `Bearer ${accessToken}`).send({ firstName: 'Jane', lastName: 'Doe', email: 'offer@acme.com' });
    const candidateId = String(cRes.body.data.id);
    const pRes = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId });
    const pipelineId = String(pRes.body.data.id);

    await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'screening' });
    await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'technical_interview' });
    const offerRes = await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'offer' });
    expect(offerRes.status).toBe(200);

    const msg = await prisma.message.findFirst({ where: { tenantId: tenant.id, type: 'offer' } });
    expect(msg?.status).toBe('sent');
  });

  it('advanceStage to rejected uses rejection path (type=rejection)', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage7-3',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage7-3@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        company: {
          create: {
            companyName: 'Acme Inc',
            companyAddress: {},
            industry: 'Software',
            companySize: '1-10',
            companyType: 'startup',
            foundedYear: 2020,
            companyWebsite: 'https://acme.example',
            officialCompanyAddress: 'Somewhere',
            companyLogo: 'logo',
            shortDescription: 'short',
            termsAccepted: true,
          },
        },
      },
    });

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some job description.' });
    const jobId = String(jobRes.body.data.id);
    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const cRes = await request(app).post('/api/v1/candidates').set('Authorization', `Bearer ${accessToken}`).send({ firstName: 'Jane', lastName: 'Doe', email: 'reject@acme.com' });
    const candidateId = String(cRes.body.data.id);
    const pRes = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId });
    const pipelineId = String(pRes.body.data.id);

    await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'screening' });
    const rejRes = await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'rejected' });
    expect(rejRes.status).toBe(200);

    const msg = await prisma.message.findFirst({ where: { tenantId: tenant.id, type: 'rejection' } });
    expect(msg?.status).toBe('sent');
  });

  it('sendEmail throws during stage advance -> stage advance still succeeds and Message.status=failed', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('smtp down'));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage7-4',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage7-4@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        company: {
          create: {
            companyName: 'Acme Inc',
            companyAddress: {},
            industry: 'Software',
            companySize: '1-10',
            companyType: 'startup',
            foundedYear: 2020,
            companyWebsite: 'https://acme.example',
            officialCompanyAddress: 'Somewhere',
            companyLogo: 'logo',
            shortDescription: 'short',
            termsAccepted: true,
          },
        },
      },
    });

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some job description.' });
    const jobId = String(jobRes.body.data.id);
    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});
    const cRes = await request(app).post('/api/v1/candidates').set('Authorization', `Bearer ${accessToken}`).send({ firstName: 'Jane', lastName: 'Doe', email: 'fail@acme.com' });
    const candidateId = String(cRes.body.data.id);
    const pRes = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId });
    const pipelineId = String(pRes.body.data.id);

    const advanceRes = await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'screening' });
    expect(advanceRes.status).toBe(200);

    const msg = await prisma.message.findFirst({ where: { tenantId: tenant.id, type: 'stage_advance' } });
    expect(msg?.status).toBe('failed');
  });

  it('assignInterviewer sends interviewer assignment email; send failure does not block assignment', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage7-5',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage7-5@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken, tenant, user } = registerRes.body.data as { accessToken: string; tenant: { id: string }; user: { id: string } };

    const recruiterRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'recruiter' } });
    if (recruiterRole) {
      await prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: recruiterRole.id } });
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        company: {
          create: {
            companyName: 'Acme Inc',
            companyAddress: {},
            industry: 'Software',
            companySize: '1-10',
            companyType: 'startup',
            foundedYear: 2020,
            companyWebsite: 'https://acme.example',
            officialCompanyAddress: 'Somewhere',
            companyLogo: 'logo',
            shortDescription: 'short',
            termsAccepted: true,
          },
        },
      },
    });

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some job description.' });
    const jobId = String(jobRes.body.data.id);
    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});
    const cRes = await request(app).post('/api/v1/candidates').set('Authorization', `Bearer ${accessToken}`).send({ firstName: 'Jane', lastName: 'Doe', email: 'cand@acme.com' });
    const candidateId = String(cRes.body.data.id);
    const pRes = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId });
    const pipelineId = String(pRes.body.data.id);

    const assignRes = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/assign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: user.id });
    expect(assignRes.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalled();

    sendEmailMock.mockReset().mockRejectedValueOnce(new Error('smtp down'));
    const assignRes2 = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/assign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: user.id });
    expect(assignRes2.status).toBe(200);
  });

  it('GET /communication/messages and /communication/notifications are paginated and scoped to tenant; POST /communication/send persists manual message', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage7-6',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage7-6@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    const sendRes = await request(app)
      .post('/api/v1/communication/send')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to: 'someone@example.com', subject: 'Hello', html: '<b>Hi</b>' });
    expect(sendRes.status).toBe(201);

    const listMessagesRes = await request(app)
      .get('/api/v1/communication/messages?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listMessagesRes.status).toBe(200);
    expect(listMessagesRes.body.data.items.every((m: any) => m.tenantId === tenant.id)).toBe(true);

    const listNotificationsRes = await request(app)
      .get('/api/v1/communication/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listNotificationsRes.status).toBe(200);
    expect(listNotificationsRes.body.data.items.every((n: any) => n.tenantId === tenant.id)).toBe(true);
  });
});

