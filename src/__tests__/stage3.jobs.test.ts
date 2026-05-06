import request from 'supertest';
import app from '../app';

describe('Stage 3: jobs + skillWeights', () => {
  it('creates job with skillWeights, returns them intact, updates, and enforces status transitions', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage3',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage3@acme.com',
      password: 'AdminA1aaaa',
    });

    expect(registerRes.status).toBe(201);
    const { accessToken } = registerRes.body.data as { accessToken: string };

    const createRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Frontend Engineer',
        description: 'We need a frontend engineer with strong React skills.',
        department: 'Engineering',
        skillWeights: [
          { skill: 'React', weight: 9 },
          { skill: 'TypeScript', weight: 8 },
        ],
        screeningQuestions: ['What is your React experience?'],
        hiringPriority: 'high',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('draft');
    expect(createRes.body.data.skillWeights).toHaveLength(2);
    const jobId = String(createRes.body.data.id);

    const getRes = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.skillWeights).toEqual([
      { skill: 'React', weight: 9 },
      { skill: 'TypeScript', weight: 8 },
    ]);

    const patchRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        skillWeights: [{ skill: 'React', weight: 10 }],
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.skillWeights).toEqual([{ skill: 'React', weight: 10 }]);

    const publishRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe('open');

    const pauseRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/pause`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe('paused');

    const publishAgainRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(publishAgainRes.status).toBe(200);
    expect(publishAgainRes.body.data.status).toBe('open');

    const closeRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.status).toBe('closed');

    const reopenRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(reopenRes.status).toBe(400);
  });
});

