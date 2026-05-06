import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Stage 9: super admin layer', () => {
  it('bootstraps once, enforces token separation, suspension, and analytics', async () => {
    const badBootstrap = await request(app)
      .post('/api/v1/superadmin/auth/bootstrap')
      .set('x-setup-key', 'wrong-key')
      .send({
        email: 'sa@kofeko.com',
        password: 'SuperAdminA1aaaa',
        firstName: 'Super',
        lastName: 'Admin',
      });
    expect(badBootstrap.status).toBe(403);

    const bootstrapRes = await request(app)
      .post('/api/v1/superadmin/auth/bootstrap')
      .set('x-setup-key', 'dev-superadmin-setup-key')
      .send({
        email: 'sa@kofeko.com',
        password: 'SuperAdminA1aaaa',
        firstName: 'Super',
        lastName: 'Admin',
      });
    expect(bootstrapRes.status).toBe(201);

    const bootstrapAgain = await request(app)
      .post('/api/v1/superadmin/auth/bootstrap')
      .set('x-setup-key', 'dev-superadmin-setup-key')
      .send({
        email: 'sa2@kofeko.com',
        password: 'SuperAdminA1aaaa',
        firstName: 'Super',
        lastName: 'Admin',
      });
    expect(bootstrapAgain.status).toBe(409);

    const loginBad = await request(app).post('/api/v1/superadmin/auth/login').send({
      email: 'sa@kofeko.com',
      password: 'wrong-password',
    });
    expect(loginBad.status).toBe(401);

    const loginRes = await request(app).post('/api/v1/superadmin/auth/login').send({
      email: 'sa@kofeko.com',
      password: 'SuperAdminA1aaaa',
    });
    expect(loginRes.status).toBe(200);
    const { accessToken: superAccess, refreshToken: superRefresh } = loginRes.body.data as {
      accessToken: string;
      refreshToken: string;
    };

    const meRes = await request(app)
      .get('/api/v1/superadmin/auth/me')
      .set('Authorization', `Bearer ${superAccess}`);
    expect(meRes.status).toBe(200);

    const refreshRes = await request(app).post('/api/v1/superadmin/auth/refresh').send({ refreshToken: superRefresh });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data).toEqual({ accessToken: expect.any(String) });

    await request(app).post('/api/v1/superadmin/auth/logout').send({ refreshToken: superRefresh });
    const refreshAfterLogout = await request(app)
      .post('/api/v1/superadmin/auth/refresh')
      .send({ refreshToken: superRefresh });
    expect(refreshAfterLogout.status).toBe(401);

    // Create a tenant user and ensure tenant token rejected on superadmin routes
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage9',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage9@acme.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes.status).toBe(201);
    const { accessToken: tenantToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    const tenantOnSuper = await request(app)
      .get('/api/v1/superadmin/auth/me')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(tenantOnSuper.status).toBe(403);

    // Super token rejected on tenant routes
    const superOnTenant = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${superAccess}`);
    expect(superOnTenant.status).toBe(403);

    // Login again to get active superadmin tokens for management calls
    const loginRes2 = await request(app).post('/api/v1/superadmin/auth/login').send({
      email: 'sa@kofeko.com',
      password: 'SuperAdminA1aaaa',
    });
    const { accessToken: superAccess2 } = loginRes2.body.data as { accessToken: string };

    const tenantsRes = await request(app)
      .get('/api/v1/superadmin/tenants?page=1&limit=50')
      .set('Authorization', `Bearer ${superAccess2}`);
    expect(tenantsRes.status).toBe(200);
    expect(tenantsRes.body.data).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        page: 1,
        limit: 50,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );

    const tenantDetail = await request(app)
      .get(`/api/v1/superadmin/tenants/${tenant.id}`)
      .set('Authorization', `Bearer ${superAccess2}`);
    expect(tenantDetail.status).toBe(200);
    expect(tenantDetail.body.data).toEqual(
      expect.objectContaining({
        id: tenant.id,
        _count: expect.objectContaining({
          users: expect.any(Number),
          jobs: expect.any(Number),
          candidates: expect.any(Number),
        }),
      }),
    );

    const suspendRes = await request(app)
      .post(`/api/v1/superadmin/tenants/${tenant.id}/suspend`)
      .set('Authorization', `Bearer ${superAccess2}`)
      .send({ reason: 'Non-payment' });
    expect(suspendRes.status).toBe(200);

    const tenantNowBlocked = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(tenantNowBlocked.status).toBe(403);

    const activateRes = await request(app)
      .post(`/api/v1/superadmin/tenants/${tenant.id}/activate`)
      .set('Authorization', `Bearer ${superAccess2}`)
      .send({});
    expect(activateRes.status).toBe(200);

    const tenantWorksAgain = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(tenantWorksAgain.status).toBe(200);

    // Platform analytics
    const seededJob = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        title: 'Role',
        description: 'Some job description.',
      },
    });
    const seededCandidate = await prisma.candidate.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane-stage9@acme.com',
      },
    });
    await prisma.evaluation.create({
      data: {
        tenantId: tenant.id,
        jobId: seededJob.id,
        candidateId: seededCandidate.id,
        score: 88,
        aiGenerated: true,
      },
    });

    const analyticsRes = await request(app)
      .get('/api/v1/superadmin/analytics')
      .set('Authorization', `Bearer ${superAccess2}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data).toEqual(
      expect.objectContaining({
        tenants: expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          suspended: expect.any(Number),
        }),
        totals: expect.objectContaining({
          users: expect.any(Number),
          jobs: expect.any(Number),
          candidates: expect.any(Number),
          evaluations: expect.any(Number),
        }),
        aiEvaluationsThisMonth: expect.any(Number),
      }),
    );
  });
});

