/// <reference types="jest" />
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Stage 10: candidate self-service portal', () => {
  it('supports candidate auth, job browsing, applying, profile updates, and strict token isolation', async () => {
    // Create a tenant + staff user
    const staffRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage10',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage10@acme.com',
      password: 'AdminA1aaaa',
    });
    expect(staffRes.status).toBe(201);
    const { accessToken: staffToken, tenant } = staffRes.body.data as { accessToken: string; tenant: { id: string; slug: string } };

    // Seed jobs: one open, one draft
    const jobOpenRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'OpenRole', description: 'Some job description.' });
    expect(jobOpenRes.status).toBe(201);
    const openJobId = String(jobOpenRes.body.data.id);
    await request(app).post(`/api/v1/jobs/${openJobId}/publish`).set('Authorization', `Bearer ${staffToken}`).send({});

    const jobDraftRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'DraftRole', description: 'Some job description.' });
    expect(jobDraftRes.status).toBe(201);
    const draftJobId = String(jobDraftRes.body.data.id);

    // Candidate register
    const registerRes = await request(app).post('/api/v1/portal/auth/registerCandidate').send({
      tenantSlug: 'acme-stage10',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(registerRes.status).toBe(201);
    const candidateId = String(registerRes.body.data.id);
    const createdCandidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(createdCandidate?.passwordHash).toBeTruthy();
    expect(createdCandidate?.status).toBe('new');

    // Duplicate register same tenant
    const duplicateRes = await request(app).post('/api/v1/portal/auth/registerCandidate').send({
      tenantSlug: 'acme-stage10',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(duplicateRes.status).toBe(409);

    // Suspended tenant blocks register
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'suspended' } });
    const suspendedRegister = await request(app).post('/api/v1/portal/auth/registerCandidate').send({
      tenantSlug: 'acme-stage10',
      firstName: 'Other',
      lastName: 'User',
      email: 'other@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(suspendedRegister.status).toBe(403);

    // Re-activate for rest of flow
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'active' } });

    // Candidate login
    const loginRes = await request(app).post('/api/v1/portal/auth/loginCandidate').send({
      tenantSlug: 'acme-stage10',
      email: 'jane@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(loginRes.status).toBe(200);
    const { accessToken: candidateToken, refreshToken } = loginRes.body.data as { accessToken: string; refreshToken: string };
    expect(typeof candidateToken).toBe('string');

    // Wrong password
    const wrongPw = await request(app).post('/api/v1/portal/auth/loginCandidate').send({
      tenantSlug: 'acme-stage10',
      email: 'jane@acme.com',
      password: 'wrong',
    });
    expect(wrongPw.status).toBe(401);

    // Recruiter-created candidate (no passwordHash) cannot login
    await prisma.candidate.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Recruiter',
        lastName: 'Added',
        email: 'recruiter-added@acme.com',
      },
    });
    const recruiterLogin = await request(app).post('/api/v1/portal/auth/loginCandidate').send({
      tenantSlug: 'acme-stage10',
      email: 'recruiter-added@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(recruiterLogin.status).toBe(401);
    expect(String(recruiterLogin.body.message)).toContain('created by a recruiter');

    // Candidate token used on staff route rejected
    const candidateOnStaff = await request(app).get('/api/v1/jobs').set('Authorization', `Bearer ${candidateToken}`);
    expect(candidateOnStaff.status).toBe(403);

    // Staff token used on candidate route rejected
    const staffOnCandidate = await request(app).get('/api/v1/portal/auth/me').set('Authorization', `Bearer ${staffToken}`);
    expect(staffOnCandidate.status).toBe(403);

    // Public job list: only open, no skillWeights field
    const jobsList = await request(app).get('/api/v1/portal/acme-stage10/jobs?page=1&limit=20');
    expect(jobsList.status).toBe(200);
    expect(Array.isArray(jobsList.body.data.items)).toBe(true);
    expect(jobsList.body.data.items.every((j: any) => j.id && j.title)).toBe(true);
    expect(jobsList.body.data.items.find((j: any) => j.id === draftJobId)).toBeFalsy();
    expect(jobsList.body.data.items.every((j: any) => !('skillWeights' in j))).toBe(true);

    // Non-open job fetch returns 404
    const draftFetch = await request(app).get(`/api/v1/portal/acme-stage10/jobs/${draftJobId}`);
    expect(draftFetch.status).toBe(404);

    // Apply to open job => pipeline at applied
    const applyRes = await request(app)
      .post(`/api/v1/portal/acme-stage10/jobs/${openJobId}/apply`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ coverLetter: 'Hello' });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.data).toEqual(
      expect.objectContaining({
        pipelineId: expect.any(String),
        jobTitle: 'OpenRole',
        stage: 'applied',
        appliedAt: expect.any(String),
      }),
    );

    // Apply twice => 409
    const applyAgain = await request(app)
      .post(`/api/v1/portal/acme-stage10/jobs/${openJobId}/apply`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({});
    expect(applyAgain.status).toBe(409);

    // Apply to non-open job => 400
    const applyToDraft = await request(app)
      .post(`/api/v1/portal/acme-stage10/jobs/${draftJobId}/apply`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({});
    expect(applyToDraft.status).toBe(400);

    // My applications list
    const myApps = await request(app)
      .get('/api/v1/portal/my-applications?page=1&limit=20')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(myApps.status).toBe(200);
    expect(myApps.body.data.items.length).toBe(1);
    const pipelineId = String(myApps.body.data.items[0].pipelineId);

    // Another candidate cannot access someone else's pipeline
    const otherRegister = await request(app).post('/api/v1/portal/auth/registerCandidate').send({
      tenantSlug: 'acme-stage10',
      firstName: 'Other',
      lastName: 'Cand',
      email: 'othercand@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(otherRegister.status).toBe(201);
    const otherLogin = await request(app).post('/api/v1/portal/auth/loginCandidate').send({
      tenantSlug: 'acme-stage10',
      email: 'othercand@acme.com',
      password: 'CandidateA1aaaa',
    });
    expect(otherLogin.status).toBe(200);
    const otherToken = String(otherLogin.body.data.accessToken);
    const otherGet = await request(app)
      .get(`/api/v1/portal/my-applications/${pipelineId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherGet.status).toBe(404);

    // Profile update: partial update; cannot change email/status (schema strict)
    const profileUpdate = await request(app)
      .patch('/api/v1/portal/profile')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ location: 'Remote', skills: ['TypeScript'] });
    expect(profileUpdate.status).toBe(200);
    expect(profileUpdate.body.data.location).toBe('Remote');
    expect(profileUpdate.body.data.skills).toEqual(['TypeScript']);

    const cannotChangeEmail = await request(app)
      .patch('/api/v1/portal/profile')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ email: 'new@acme.com' });
    expect(cannotChangeEmail.status).toBe(400);

    // Refresh
    const refreshRes = await request(app).post('/api/v1/portal/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data).toEqual({ accessToken: expect.any(String) });
  });
});

