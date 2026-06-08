import crypto from 'node:crypto';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

jest.mock('../common/email/emailProvider', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const { sendEmail } = jest.requireMock('../common/email/emailProvider') as {
  sendEmail: jest.Mock;
};

const QA_EMAIL = 'module1-signup@example.test';

function buildValidCompanyRegistrationBody(emailVerificationToken: string, adminEmail: string) {
  return {
    companyName: 'QA Signup Co',
    companyAddress: {
      country: 'United States',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94102',
      fullAddress: '123 Market Street, Suite 400',
    },
    industry: 'Technology',
    companySize: '11-50' as const,
    companyType: 'startup' as const,
    foundedYear: 2020,
    companyWebsite: 'https://qa-signup.example.test',
    officialCompanyAddress: '123 Market Street, San Francisco, CA 94102',
    phoneNumber: '+14155552671',
    companyLogo: 'https://qa-signup.example.test/logo.png',
    shortDescription: 'Automated test company registration request for Module 1 QA.',
    linkedinUrl: '',
    twitterUrl: '',
    termsAccepted: true as const,
    adminEmail,
    password: 'SignupPass1',
    emailVerificationToken,
  };
}

describe('Module 1: company signup email OTP + registration request', () => {
  let randomIntSpy: jest.SpiedFunction<typeof crypto.randomInt>;

  beforeEach(() => {
    randomIntSpy = jest.spyOn(crypto, 'randomInt').mockImplementation(() => 654321);
    sendEmail.mockClear();
  });

  afterEach(() => {
    randomIntSpy.mockRestore();
  });

  it('rejects send OTP with invalid email body', async () => {
    const res = await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('sends OTP (200) and dispatches email', async () => {
    const res = await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: QA_EMAIL });
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0] as { to: string; html: string };
    expect(sent.to).toBe(QA_EMAIL.toLowerCase());
    expect(sent.html).toContain('654321');
  });

  it('rate-limits immediate second OTP send for same email (429)', async () => {
    const first = await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: QA_EMAIL });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: QA_EMAIL });
    expect(second.status).toBe(429);
  });

  it('rejects verify with wrong 6-digit code (400)', async () => {
    await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: QA_EMAIL });

    const res = await request(app).post('/api/v1/auth/register-company-email-otp/verify').send({
      email: QA_EMAIL,
      code: '111111',
    });
    expect(res.status).toBe(400);
  });

  it('verifies OTP and returns emailVerificationToken; registration request succeeds (201)', async () => {
    await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: QA_EMAIL });

    const verifyRes = await request(app).post('/api/v1/auth/register-company-email-otp/verify').send({
      email: QA_EMAIL,
      code: '654321',
    });
    expect(verifyRes.status).toBe(200);
    const token = verifyRes.body.data?.emailVerificationToken as string | undefined;
    expect(token).toEqual(expect.any(String));
    expect(token!.length).toBeGreaterThan(20);

    const body = buildValidCompanyRegistrationBody(token!, QA_EMAIL);

    const regRes = await request(app).post('/api/v1/auth/register-company-request').send(body);
    expect(regRes.status).toBe(201);
    expect(regRes.body.data?.status).toBe('pending');
    expect(regRes.body.data?.requestId).toEqual(expect.any(String));

    const row = await prisma.companyRegistrationRequest.findUnique({
      where: { id: regRes.body.data.requestId },
    });
    expect(row?.adminEmail).toBe(QA_EMAIL.toLowerCase());
    expect(row?.termsAccepted).toBe(true);
  });

  it('returns per-field validation details (not collapsed body array)', async () => {
    const res = await request(app).post('/api/v1/auth/register-company-request').send({
      companyName: 'X',
      companyAddress: {
        country: 'US',
        state: 'CA',
        city: 'SF',
        zipCode: '94102',
        fullAddress: '123 St',
      },
      industry: 'Tech',
      companySize: '1-10',
      companyType: 'startup',
      foundedYear: 2099,
      companyWebsite: 'not-a-url',
      officialCompanyAddress: '123 St',
      phoneNumber: '+1',
      companyLogo: '',
      shortDescription: 'short',
      termsAccepted: true,
      adminEmail: 'bad@example.com',
      password: 'short',
      emailVerificationToken: 'x'.repeat(30),
    });
    expect(res.status).toBe(400);
    const fieldErrors = res.body.details?.fieldErrors as Record<string, string[]> | undefined;
    expect(fieldErrors).toBeDefined();
    expect(fieldErrors?.['body.companyLogo'] ?? fieldErrors?.companyLogo).toBeUndefined();
    expect(fieldErrors?.['body.shortDescription'] ?? fieldErrors?.shortDescription).toBeDefined();
    expect(Array.isArray(fieldErrors?.body)).toBe(false);
  });

  it('rejects registration with invalid phone (validation)', async () => {
    await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: QA_EMAIL });
    const verifyRes = await request(app).post('/api/v1/auth/register-company-email-otp/verify').send({
      email: QA_EMAIL,
      code: '654321',
    });
    const token = verifyRes.body.data.emailVerificationToken as string;

    const bad = {
      ...buildValidCompanyRegistrationBody(token, QA_EMAIL),
      phoneNumber: '+12',
    };

    const regRes = await request(app).post('/api/v1/auth/register-company-request').send(bad);
    expect(regRes.status).toBe(400);
    const fieldErrors = regRes.body.details?.fieldErrors as Record<string, string[]> | undefined;
    expect(fieldErrors?.['body.phoneNumber'] ?? fieldErrors?.phoneNumber).toBeDefined();
  });

  it('accepts company website without scheme (prepends https)', async () => {
    await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email: 'website-norm@example.test' });
    const verifyRes = await request(app).post('/api/v1/auth/register-company-email-otp/verify').send({
      email: 'website-norm@example.test',
      code: '654321',
    });
    const token = verifyRes.body.data.emailVerificationToken as string;
    const body = {
      ...buildValidCompanyRegistrationBody(token, 'website-norm@example.test'),
      companyWebsite: 'www.example.test',
    };
    const regRes = await request(app).post('/api/v1/auth/register-company-request').send(body);
    expect(regRes.status).toBe(201);
  });

  it('accepts registration without JWT when email OTP was recently verified', async () => {
    const email = 'otp-fallback@example.test';
    await request(app).post('/api/v1/auth/register-company-email-otp/send').send({ email });
    await request(app).post('/api/v1/auth/register-company-email-otp/verify').send({
      email,
      code: '654321',
    });

    const body = {
      ...buildValidCompanyRegistrationBody('unused-token-should-not-matter', email),
      emailVerificationToken: undefined,
    };

    const regRes = await request(app).post('/api/v1/auth/register-company-request').send(body);
    expect(regRes.status).toBe(201);
  });
});

describe('Module 1: candidate registration', () => {
  it('registers a candidate (201)', async () => {
    const res = await request(app).post('/api/v1/auth/register-candidate').send({
      firstName: 'Module',
      lastName: 'One',
      email: 'module1-candidate@example.test',
      password: 'Candidate1',
    });
    expect(res.status).toBe(201);
    expect(res.body.data?.user?.email).toBe('module1-candidate@example.test');
  });
});
