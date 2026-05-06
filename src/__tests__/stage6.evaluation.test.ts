import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

jest.mock('../common/ai/replicateGpt', () => ({
  replicateGpt52JsonCompletion: jest.fn(),
}));

import { replicateGpt52JsonCompletion } from '../common/ai/replicateGpt';

const MOCK_ANALYSIS_RESULT = {
  parsedResume: {
    summary: 'Experienced full-stack developer',
    skills: ['React', 'Node.js', 'PostgreSQL'],
    experience: [{ company: 'Acme', title: 'Engineer', dates: '2021-2024', highlights: ['Built APIs'] }],
    education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', dates: '2017-2021' }],
    projects: [],
    hobbies: ['hiking'],
  },
  scores: {
    overall: 82,
    sections: { education: 75, experience: 85, skills: 88, projects: 60, professionalSummary: 70, hobbies: 10 },
    skillMatches: [
      { skill: 'React', weight: 9, matched: true, contribution: 18, evidence: 'React mentioned in experience' },
    ],
    roleFitNotes: 'Strong frontend match, limited Python exposure.',
  },
  rankingSummary: 'Strong candidate with 3 years of relevant experience.',
};

describe('Stage 6: AI evaluations', () => {
  const replicateMock = replicateGpt52JsonCompletion as unknown as jest.Mock;

  beforeEach(() => {
    replicateMock.mockReset();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from('hello resume').buffer,
    });
  });

  it('POST /evaluations/ai-evaluate persists AI fields, includes one skillMatch per job skillWeight, and writes audit log', async () => {
    replicateMock.mockResolvedValue(JSON.stringify(MOCK_ANALYSIS_RESULT));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-1',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-1@acme.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes.status).toBe(201);
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Fullstack',
        description: 'We need React and Python.',
        skillWeights: [
          { skill: 'React', weight: 9 },
          { skill: 'Python', weight: 7 },
        ],
      });
    expect(jobRes.status).toBe(201);
    const jobId = String(jobRes.body.data.id);

    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage6-1@acme.com' });
    expect(candidateRes.status).toBe(201);
    const candidateId = String(candidateRes.body.data.id);

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' },
    });

    const pipelineRes = await request(app)
      .post('/api/v1/pipelines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(pipelineRes.status).toBe(201);
    const pipelineId = String(pipelineRes.body.data.id);

    const evalRes = await request(app)
      .post('/api/v1/evaluations/ai-evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId, pipelineId });
    expect(evalRes.status).toBe(201);
    expect(evalRes.body.data.aiGenerated).toBe(true);
    expect(evalRes.body.data.score).toBe(82);
    expect(evalRes.body.data.rankingSummary).toBe(MOCK_ANALYSIS_RESULT.rankingSummary);
    expect(evalRes.body.data.sectionScores).toBeTruthy();
    expect(evalRes.body.data.parsedResumeData).toBeTruthy();

    const saved = await prisma.evaluation.findFirst({ where: { tenantId: tenant.id, candidateId, jobId } });
    expect(saved?.aiGenerated).toBe(true);
    expect(saved?.score).toBe(82);
    expect(Array.isArray(saved?.skillMatches)).toBe(true);
    expect((saved?.skillMatches as any[]).length).toBe(2);
    const skills = (saved?.skillMatches as any[]).map((r) => r.skill);
    expect(skills).toEqual(expect.arrayContaining(['React', 'Python']));

    const audits = await prisma.auditLog.findMany({ where: { tenantId: tenant.id, action: 'ai_evaluate' } });
    expect(audits.length).toBeGreaterThan(0);
  });

  it('Candidate with no resumeUrl returns 400', async () => {
    replicateMock.mockResolvedValue(JSON.stringify(MOCK_ANALYSIS_RESULT));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-2',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-2@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken } = registerRes.body.data as { accessToken: string };

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some description', skillWeights: [] });
    const jobId = String(jobRes.body.data.id);

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'No', lastName: 'Resume', email: 'no-resume@acme.com' });
    const candidateId = String(candidateRes.body.data.id);

    const evalRes = await request(app)
      .post('/api/v1/evaluations/ai-evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(evalRes.status).toBe(400);
  });

  it('Job not found returns 404', async () => {
    replicateMock.mockResolvedValue(JSON.stringify(MOCK_ANALYSIS_RESULT));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-3',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-3@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken } = registerRes.body.data as { accessToken: string };

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage6-3@acme.com' });
    const candidateId = String(candidateRes.body.data.id);

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' },
    });

    const evalRes = await request(app)
      .post('/api/v1/evaluations/ai-evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId: '00000000-0000-0000-0000-000000000000', candidateId });
    expect(evalRes.status).toBe(404);
  });

  it('Replicate throws -> 502 with clean message (no stack)', async () => {
    replicateMock.mockRejectedValue(new Error('replicate down'));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-4',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-4@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken } = registerRes.body.data as { accessToken: string };

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some description', skillWeights: [] });
    const jobId = String(jobRes.body.data.id);

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage6-4@acme.com' });
    const candidateId = String(candidateRes.body.data.id);

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' },
    });

    const evalRes = await request(app)
      .post('/api/v1/evaluations/ai-evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    expect(evalRes.status).toBe(502);
    expect(String(evalRes.body.message)).toContain('AI evaluation failed');
    expect(evalRes.body.stack).toBeUndefined();
  });

  it('POST /jobs/:jobId/evaluate-all evaluates unevaluated candidates, skips existing AI evals, and continues after failures', async () => {
    replicateMock.mockResolvedValue(JSON.stringify(MOCK_ANALYSIS_RESULT));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-5',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-5@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some description', skillWeights: [{ skill: 'React', weight: 9 }] });
    const jobId = String(jobRes.body.data.id);

    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const createCandidate = async (email: string) => {
      const c = await request(app)
        .post('/api/v1/candidates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'Carl', lastName: 'User', email });
      expect(c.status).toBe(201);
      const id = String(c.body.data.id);
      await prisma.candidate.update({
        where: { id },
        data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' },
      });
      return id;
    };

    const c1 = await createCandidate('c1-stage6@acme.com');
    const c2 = await createCandidate('c2-stage6@acme.com');
    const c3 = await createCandidate('c3-stage6@acme.com');

    const p1 = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId: c1 });
    const p2 = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId: c2 });
    const p3 = await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId: c3 });
    expect(p1.status).toBe(201);
    expect(p2.status).toBe(201);
    expect(p3.status).toBe(201);

    // Seed an existing AI evaluation for c3 so batch skips it.
    await prisma.evaluation.create({
      data: {
        tenantId: tenant.id,
        jobId,
        candidateId: c3,
        pipelineId: String(p3.body.data.id),
        score: 99,
        aiGenerated: true,
      },
    });

    const batchRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/evaluate-all`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.data.evaluated).toBe(2);
    expect(batchRes.body.data.failed).toBe(0);

    // Now make one fail and ensure the other still evaluates.
    replicateMock
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify(MOCK_ANALYSIS_RESULT))
      .mockRejectedValueOnce(new Error('rate limited'));

    await prisma.evaluation.deleteMany({ where: { tenantId: tenant.id, jobId, aiGenerated: true } });
    await prisma.pipeline.delete({ where: { id: String(p3.body.data.id) } });

    const batchRes2 = await request(app)
      .post(`/api/v1/jobs/${jobId}/evaluate-all`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(batchRes2.status).toBe(200);
    expect(batchRes2.body.data.evaluated).toBe(1);
    expect(batchRes2.body.data.failed).toBe(1);
  });

  it('GET /jobs/:jobId/rankings returns sorted rankings with rank starting at 1', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-6',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-6@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken } = registerRes.body.data as { accessToken: string };

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some description', skillWeights: [] });
    const jobId = String(jobRes.body.data.id);

    await request(app).post(`/api/v1/jobs/${jobId}/publish`).set('Authorization', `Bearer ${accessToken}`).send({});

    const c1Res = await request(app).post('/api/v1/candidates').set('Authorization', `Bearer ${accessToken}`).send({ firstName: 'Alice', lastName: 'Alpha', email: 'rank-a@acme.com' });
    const c2Res = await request(app).post('/api/v1/candidates').set('Authorization', `Bearer ${accessToken}`).send({ firstName: 'Bobby', lastName: 'Beta', email: 'rank-b@acme.com' });
    const c1 = String(c1Res.body.data.id);
    const c2 = String(c2Res.body.data.id);
    await prisma.candidate.update({ where: { id: c1 }, data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' } });
    await prisma.candidate.update({ where: { id: c2 }, data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' } });

    await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId: c1 });
    await request(app).post('/api/v1/pipelines').set('Authorization', `Bearer ${accessToken}`).send({ jobId, candidateId: c2 });

    replicateMock
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify({ ...MOCK_ANALYSIS_RESULT, scores: { ...MOCK_ANALYSIS_RESULT.scores, overall: 90 } }))
      .mockResolvedValueOnce(JSON.stringify({ ...MOCK_ANALYSIS_RESULT, scores: { ...MOCK_ANALYSIS_RESULT.scores, overall: 70 } }));

    await request(app).post(`/api/v1/jobs/${jobId}/evaluate-all`).set('Authorization', `Bearer ${accessToken}`).send({});

    const rankingsRes = await request(app)
      .get(`/api/v1/jobs/${jobId}/rankings`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(rankingsRes.status).toBe(200);
    expect(rankingsRes.body.data[0].rank).toBe(1);
    expect(rankingsRes.body.data[0].evaluation.score).toBe(90);
    expect(rankingsRes.body.data[1].rank).toBe(2);
    expect(rankingsRes.body.data[1].evaluation.score).toBe(70);
  });

  it('PATCH /evaluations/:id allows recruiter override of score and whyCard', async () => {
    replicateMock.mockResolvedValue(JSON.stringify(MOCK_ANALYSIS_RESULT));

    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage6-7',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage6-7@acme.com',
      password: 'AdminA1aaaa',
    });
    const { accessToken } = registerRes.body.data as { accessToken: string };

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Role', description: 'Some description', skillWeights: [] });
    const jobId = String(jobRes.body.data.id);

    const candidateRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane-stage6-7@acme.com' });
    const candidateId = String(candidateRes.body.data.id);
    await prisma.candidate.update({ where: { id: candidateId }, data: { resumeUrl: 'http://example.com/resume.txt', resumeMimeType: 'text/plain' } });

    const evalRes = await request(app)
      .post('/api/v1/evaluations/ai-evaluate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId, candidateId });
    const evaluationId = String(evalRes.body.data.id);

    const patchRes = await request(app)
      .patch(`/api/v1/evaluations/${evaluationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ score: 55, whyCard: 'Manual override' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.score).toBe(55);
    expect(patchRes.body.data.whyCard).toBe('Manual override');
  });
});

