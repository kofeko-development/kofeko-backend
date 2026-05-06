import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Stage 2: company onboarding', () => {
  it('creates a company for tenant, GET returns profile, PATCH updates, and second POST returns 409', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@acme.com',
      password: 'AdminA1aaaa',
    });

    expect(registerRes.status).toBe(201);
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    const createPayload = {
      companyName: 'Acme Inc',
      industry: 'Software',
      companySize: '11-50',
      companyType: 'startup',
      foundedYear: 2018,
      companyWebsite: 'https://acme.example',
      officialCompanyAddress: '123 Main Street, Springfield',
      phoneNumber: '1234567890',
      companyLogo: 'https://acme.example/logo.png',
      shortDescription: 'We build hiring tools for teams across the world.',
      linkedinUrl: 'https://linkedin.com/company/acme',
      twitterUrl: 'https://twitter.com/acme',
      termsAccepted: true,
    };

    const createRes = await request(app)
      .post('/api/v1/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createPayload);

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.company.companyName).toBe('Acme Inc');
    expect(createRes.body.data.tenant.id).toBe(tenant.id);

    const tenantRow = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(tenantRow?.companyId).toBeTruthy();

    const secondCreate = await request(app)
      .post('/api/v1/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createPayload);

    expect(secondCreate.status).toBe(409);

    const getRes = await request(app).get('/api/v1/company').set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.company.companyName).toBe('Acme Inc');
    expect(getRes.body.data.tenant.id).toBe(tenant.id);

    const patchRes = await request(app)
      .patch('/api/v1/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shortDescription: 'Updated description for Acme company profile.',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.company.shortDescription).toBe('Updated description for Acme company profile.');

    const getRes2 = await request(app).get('/api/v1/company').set('Authorization', `Bearer ${accessToken}`);
    expect(getRes2.status).toBe(200);
    expect(getRes2.body.data.company.shortDescription).toBe('Updated description for Acme company profile.');
  });
});
