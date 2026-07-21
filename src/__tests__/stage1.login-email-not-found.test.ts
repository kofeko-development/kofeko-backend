/// <reference types="jest" />
import request from 'supertest';
import app from '../app';

jest.setTimeout(30000);

describe('Stage 1: login EMAIL_NOT_FOUND', () => {
  it('staff login returns EMAIL_NOT_FOUND for unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      tenantSlug: 'nonexistent-tenant-slug',
      email: 'nobody@unknown.test',
      password: 'WrongPass1',
    });

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('EMAIL_NOT_FOUND');
    expect(res.body.details?.fieldErrors?.email).toBeTruthy();
  });

  it('staff login returns UNAUTHORIZED for wrong password on existing tenant', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Email Test Co',
      tenantSlug: 'email-test-co',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@email-test.com',
      password: 'AdminA1aaaa',
    });
    expect(registerRes.status).toBe(201);

    const res = await request(app).post('/api/v1/auth/login').send({
      tenantSlug: 'email-test-co',
      email: 'admin@email-test.com',
      password: 'WrongPass1',
    });

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('UNAUTHORIZED');
    expect(res.body.details?.fieldErrors?.email).toBeUndefined();
  });

  it('candidate login returns EMAIL_NOT_FOUND for unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login-candidate').send({
      email: 'nocandidate@unknown.test',
      password: 'WrongPass1',
    });

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('EMAIL_NOT_FOUND');
    expect(res.body.details?.fieldErrors?.email).toBeTruthy();
  });

  it('superadmin login returns EMAIL_NOT_FOUND for unknown email', async () => {
    const res = await request(app).post('/api/v1/superadmin/auth/login').send({
      email: 'nosuper@unknown.test',
      password: 'WrongPass1',
    });

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('EMAIL_NOT_FOUND');
    expect(res.body.details?.fieldErrors?.email).toBeTruthy();
  });
});
