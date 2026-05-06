import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Stage 5: pipelines', () => {
  it('creates pipelines for open jobs, enforces transitions, assigns interviewer, sets SLA, lists with filters, and writes audit logs', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage5',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage5@acme.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes.status).toBe(201);
    const { accessToken, tenant, user } = registerRes.body.data as {
      accessToken: string;
      tenant: { id: string };
      user: { id: string };
    };

    const openJobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some job description.' });
    expect(openJobRes.status).toBe(201);
    const jobId = String(openJobRes.body.data.id);

    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const draftJobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'DraftRole', description: 'Some job description.' });
    expect(draftJobRes.status).toBe(201);
    const draftJobId = String(draftJobRes.body.data.id);

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage5@acme.com' });
    expect(candidateRes.status).toBe(201);
    const candidateId = String(candidateRes.body.data.id);

    const createDraftPipeline = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId: draftJobId, candidateId });
    expect(createDraftPipeline.status).toBe(400);

    const createPipelineRes = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(createPipelineRes.status).toBe(201);
    expect(createPipelineRes.body.data.stage).toBe('applied');
    const pipelineId = String(createPipelineRes.body.data.id);

    const dupRes = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(dupRes.status).toBe(409);

    const illegalSkip = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/advance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stage: 'technical_interview' });
    expect(illegalSkip.status).toBe(400);

    const toScreening = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/advance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stage: 'screening', note: 'start screening' });
    expect(toScreening.status).toBe(200);
    expect(toScreening.body.data.stage).toBe('screening');

    const candidateAfterScreening = await request(app)
      .get(`/api/v1/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(candidateAfterScreening.status).toBe(200);
    expect(candidateAfterScreening.body.data.status).toBe('screening');

    const toRejected = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/advance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stage: 'rejected', note: 'no fit' });
    expect(toRejected.status).toBe(200);

    const candidateAfterReject = await request(app)
      .get(`/api/v1/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(candidateAfterReject.body.data.status).toBe('rejected');

    const terminalAdvance = await request(app)
      .post(`/api/v1/pipelines/${pipelineId}/advance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stage: 'hired' });
    expect(terminalAdvance.status).toBe(400);

    // Create another pipeline to test offer->hired
    const candidate2Res = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'John', lastName: 'Smith', email: 'john-stage5@acme.com' });
    expect(candidate2Res.status).toBe(201);
    const candidate2Id = String(candidate2Res.body.data.id);

    const pipeline2Res = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId: candidate2Id });
    expect(pipeline2Res.status).toBe(201);
    const pipeline2Id = String(pipeline2Res.body.data.id);

    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'screening' });
    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'technical_interview' });
    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'offer' });
    const hireRes = await request(app)
      .post(`/api/v1/pipelines/${pipeline2Id}/advance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ stage: 'hired' });
    expect(hireRes.status).toBe(200);

    const candidate2AfterHire = await request(app)
      .get(`/api/v1/candidates/${candidate2Id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(candidate2AfterHire.body.data.status).toBe('hired');

    // Assign interviewer: use admin user id (likely company_admin; may not pass role check)
    // Create a recruiter role assignment for this user so it passes
    const recruiterRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'recruiter' } });
    if (recruiterRole) {
      await prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: recruiterRole.id } });
    }

    const assignRes = await request(app)
      .post(`/api/v1/pipelines/${pipeline2Id}/assign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: user.id });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.assignedTo).toBe(user.id);

    const past = new Date(Date.now() - 60_000).toISOString();
    const pastSla = await request(app)
      .post(`/api/v1/pipelines/${pipeline2Id}/sla`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ deadline: past });
    expect(pastSla.status).toBe(400);

    const future = new Date(Date.now() + 60_000).toISOString();
    const futureSla = await request(app)
      .post(`/api/v1/pipelines/${pipeline2Id}/sla`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ deadline: future });
    expect(futureSla.status).toBe(200);

    const listByJob = await request(app)
      .get(`/api/v1/pipelines?jobId=${jobId}&page=1&limit=10`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listByJob.status).toBe(200);

    const listByCandidate = await request(app)
      .get(`/api/v1/pipelines?candidateId=${candidate2Id}&page=1&limit=10`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listByCandidate.status).toBe(200);

    // audit logs exist for create, advance, assign, sla (action is stored as enum; we assert rows exist)
    const audits = await prisma.auditLog.findMany({
      where: { tenantId: tenant.id, entityType: 'pipeline' },
    });
    expect(audits.length).toBeGreaterThan(0);
  });
});

