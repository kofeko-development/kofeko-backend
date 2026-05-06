import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Stage 8: analytics + audit', () => {
  it('returns summary, funnel, distributions, recent activity, velocity, and filtered audit logs scoped to tenant', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage8',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage8@acme.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes.status).toBe(201);
    const { accessToken, tenant } = registerRes.body.data as {
      accessToken: string;
      tenant: { id: string };
    };

    const jobDraft = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'DraftRole', description: 'Some job description.' });
    expect(jobDraft.status).toBe(201);

    const jobOpen = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'OpenRole', description: 'Some job description.' });
    expect(jobOpen.status).toBe(201);
    const jobId = String(jobOpen.body.data.id);
    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const candidateNew = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage8@acme.com' });
    expect(candidateNew.status).toBe(201);
    const candidateId = String(candidateNew.body.data.id);

    const candidate2 = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'John', lastName: 'Smith', email: 'john-stage8@acme.com' });
    expect(candidate2.status).toBe(201);
    const candidate2Id = String(candidate2.body.data.id);

    const pipeline1 = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(pipeline1.status).toBe(201);
    const pipelineId = String(pipeline1.body.data.id);

    await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'screening' });
    await request(app).post(`/api/v1/pipelines/${pipelineId}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'technical_interview' });

    const pipeline2 = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId: candidate2Id });
    expect(pipeline2.status).toBe(201);
    const pipeline2Id = String(pipeline2.body.data.id);
    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'screening' });
    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'technical_interview' });
    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'offer' });
    await request(app).post(`/api/v1/pipelines/${pipeline2Id}/advance`).set('Authorization', `Bearer ${accessToken}`).send({ stage: 'hired' });

    // Seed evaluations: one AI, one non-AI
    await prisma.evaluation.create({
      data: {
        tenantId: tenant.id,
        jobId,
        candidateId,
        pipelineId,
        score: 90,
        aiGenerated: true,
      },
    });
    await prisma.evaluation.create({
      data: {
        tenantId: tenant.id,
        jobId,
        candidateId: candidate2Id,
        pipelineId: pipeline2Id,
        score: 70,
        aiGenerated: false,
      },
    });

    // Ensure audit logs exist for job/pipeline actions already performed
    const summaryRes = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data).toEqual(
      expect.objectContaining({
        totalJobs: expect.any(Number),
        openJobs: expect.any(Number),
        totalCandidates: expect.any(Number),
        newCandidates: expect.any(Number),
        screeningCandidates: expect.any(Number),
        hiredCandidates: expect.any(Number),
        rejectedCandidates: expect.any(Number),
        totalPipelines: expect.any(Number),
        activePipelines: expect.any(Number),
        totalEvaluations: expect.any(Number),
        aiEvaluations: expect.any(Number),
        activeUsers: expect.any(Number),
      }),
    );
    expect(summaryRes.body.data.openJobs).toBe(1);
    expect(summaryRes.body.data.aiEvaluations).toBe(1);

    const funnelRes = await request(app)
      .get('/api/v1/analytics/pipeline-funnel')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(funnelRes.status).toBe(200);
    expect(funnelRes.body.data).toEqual(
      expect.objectContaining({
        applied: expect.any(Number),
        screening: expect.any(Number),
        technical_interview: expect.any(Number),
        hr_interview: expect.any(Number),
        offer: expect.any(Number),
        hired: expect.any(Number),
        rejected: expect.any(Number),
      }),
    );

    const funnelByJob = await request(app)
      .get(`/api/v1/analytics/pipeline-funnel?jobId=${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(funnelByJob.status).toBe(200);

    const ttdRes = await request(app)
      .get('/api/v1/analytics/time-to-decision')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(ttdRes.status).toBe(200);
    expect(ttdRes.body.data === null || typeof ttdRes.body.data === 'number').toBe(true);

    const distRes = await request(app)
      .get('/api/v1/analytics/score-distribution')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(distRes.status).toBe(200);
    expect(distRes.body.data).toEqual(
      expect.objectContaining({
        '0-49': expect.any(Number),
        '50-69': expect.any(Number),
        '70-84': expect.any(Number),
        '85-100': expect.any(Number),
      }),
    );
    expect(distRes.body.data['85-100']).toBe(1);

    const activityRes = await request(app)
      .get('/api/v1/analytics/recent-activity?limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(activityRes.status).toBe(200);
    if (activityRes.body.data.length) {
      expect(activityRes.body.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          actorName: expect.any(String),
        }),
      );
    }

    const velocityRes = await request(app)
      .get('/api/v1/analytics/hiring-velocity')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(velocityRes.status).toBe(200);
    expect(Array.isArray(velocityRes.body.data)).toBe(true);
    expect(velocityRes.body.data.length).toBe(6);

    // Audit list filter by entityType=job
    const auditJobs = await request(app)
      .get('/api/v1/audit/logs?entityType=job&page=1&limit=50')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(auditJobs.status).toBe(200);
    expect(auditJobs.body.data.items.every((row: any) => row.entityType === 'job')).toBe(true);

    // Tenant scoping: create another tenant and ensure no visibility
    const registerRes2 = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Other',
      tenantSlug: 'other-stage8',
      firstName: 'Other',
      lastName: 'Admin',
      email: 'admin-stage8@other.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes2.status).toBe(201);
    const { accessToken: otherToken } = registerRes2.body.data as { accessToken: string };

    const otherAudit = await request(app)
      .get('/api/v1/audit/logs?page=1&limit=10')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherAudit.status).toBe(200);

    // Single audit log by id (same tenant)
    const anyAudit = await prisma.auditLog.findFirst({ where: { tenantId: tenant.id } });
    expect(anyAudit).toBeTruthy();
    const auditById = await request(app)
      .get(`/api/v1/audit/logs/${anyAudit!.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(auditById.status).toBe(200);

    // Cross-tenant audit get returns 404
    const auditByIdOtherTenant = await request(app)
      .get(`/api/v1/audit/logs/${anyAudit!.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(auditByIdOtherTenant.status).toBe(404);
  });
});

