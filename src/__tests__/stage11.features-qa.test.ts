/// <reference types="jest" />
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

jest.setTimeout(120000); // 120 seconds timeout to accommodate remote database pooler roundtrip delays

jest.mock('../common/email/emailProvider', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const { sendEmail } = jest.requireMock('../common/email/emailProvider') as {
  sendEmail: jest.Mock;
};

const QA_ADMIN_EMAIL = 'admin@minimalltd.test';
const QA_CANDIDATE_EMAIL = 'candidate@qa.test';

function buildMinimalCompanyRegistrationBody(emailVerificationToken: string, adminEmail: string) {
  return {
    companyName: 'QA Minimal Co',
    companyAddress: {
      country: 'United States',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94102',
      fullAddress: '123 Market Street, Suite 400',
    },
    industry: 'Technology',
    phoneNumber: '+14155552671',
    adminEmail,
    password: 'SignupPass1',
    emailVerificationToken,
  };
}

describe('Stage 11: QA Test Suite for new features', () => {
  let superAccess: string;

  beforeEach(async () => {
    sendEmail.mockClear();

    // 1. Clear Settings Table
    await prisma.systemSetting.deleteMany();

    // 2. Bootstrap Super Admin
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

    // 3. Login Super Admin
    const loginRes = await request(app).post('/api/v1/superadmin/auth/login').send({
      email: 'sa@kofeko.com',
      password: 'SuperAdminA1aaaa',
    });
    expect(loginRes.status).toBe(200);
    superAccess = loginRes.body.data.accessToken;
  });

  describe('Scenario 1: SuperAdmin Settings API', () => {
    it('should retrieve default disabled auto-approve settings', async () => {
      const getRes = await request(app)
        .get('/api/v1/superadmin/settings/auto-approve')
        .set('Authorization', `Bearer ${superAccess}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.autoApprove).toBe(false);
    });

    it('should toggle auto-approve setting and persist state', async () => {
      // Toggle ON
      const toggleOnRes = await request(app)
        .post('/api/v1/superadmin/settings/auto-approve')
        .set('Authorization', `Bearer ${superAccess}`)
        .send({ enabled: true });
      expect(toggleOnRes.status).toBe(200);
      expect(toggleOnRes.body.data.autoApprove).toBe(true);

      // Verify GET returns true
      const getRes = await request(app)
        .get('/api/v1/superadmin/settings/auto-approve')
        .set('Authorization', `Bearer ${superAccess}`);
      expect(getRes.body.data.autoApprove).toBe(true);

      // Toggle OFF
      const toggleOffRes = await request(app)
        .post('/api/v1/superadmin/settings/auto-approve')
        .set('Authorization', `Bearer ${superAccess}`)
        .send({ enabled: false });
      expect(toggleOffRes.status).toBe(200);
      expect(toggleOffRes.body.data.autoApprove).toBe(false);
    });

    it('should reject requests without superadmin authorization', async () => {
      const getRes = await request(app)
        .get('/api/v1/superadmin/settings/auto-approve');
      expect(getRes.status).toBe(401);
    });
  });

  describe('Scenario 2: Company Registration (Manual vs Auto-Approval)', () => {
    let emailVerificationToken: string;
    let randomIntSpy: jest.SpiedFunction<typeof crypto.randomInt>;

    beforeEach(async () => {
      randomIntSpy = jest.spyOn(crypto, 'randomInt').mockImplementation(() => 654321);

      // Send and verify OTP
      await request(app)
        .post('/api/v1/auth/register-company-email-otp/send')
        .send({ email: QA_ADMIN_EMAIL });

      const verifyRes = await request(app)
        .post('/api/v1/auth/register-company-email-otp/verify')
        .send({
          email: QA_ADMIN_EMAIL,
          code: '654321',
        });
      expect(verifyRes.status).toBe(200);
      emailVerificationToken = verifyRes.body.data.emailVerificationToken;
    });

    afterEach(() => {
      randomIntSpy.mockRestore();
    });

    it('should register company as pending when autoApprove is OFF', async () => {
      const body = buildMinimalCompanyRegistrationBody(emailVerificationToken, QA_ADMIN_EMAIL);
      const regRes = await request(app)
        .post('/api/v1/auth/register-company-request')
        .send(body);

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.status).toBe('pending');

      const requestRow = await prisma.companyRegistrationRequest.findUnique({
        where: { id: regRes.body.data.requestId },
      });
      expect(requestRow).toBeDefined();
      expect(requestRow?.companySize).toBe('1-10'); // Zod default applied
      expect(requestRow?.companyType).toBe('startup'); // Zod default applied
      expect(requestRow?.companyWebsite).toBe('https://example.com'); // Zod default applied
      expect(requestRow?.shortDescription).toBe('Company profile details will be updated soon.'); // Zod default applied
    }, 60000);

    it('should auto-approve company, create tenant & user when autoApprove is ON', async () => {
      // Toggle ON
      await request(app)
        .post('/api/v1/superadmin/settings/auto-approve')
        .set('Authorization', `Bearer ${superAccess}`)
        .send({ enabled: true });

      const body = buildMinimalCompanyRegistrationBody(emailVerificationToken, QA_ADMIN_EMAIL);
      const regRes = await request(app)
        .post('/api/v1/auth/register-company-request')
        .send(body);

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.status).toBe('approved');
      expect(regRes.body.data.tenantSlug).toBe('qa-minimal-co');

      const requestRow = await prisma.companyRegistrationRequest.findUnique({
        where: { id: regRes.body.data.requestId },
      });
      expect(requestRow?.status).toBe('approved');

      const tenantRow = await prisma.tenant.findUnique({
        where: { slug: 'qa-minimal-co' },
        include: { company: true },
      });
      expect(tenantRow).toBeDefined();
      expect(tenantRow?.company?.companyName).toBe('QA Minimal Co');

      // Try registering a second company with same name to test slug collision handling
      const otherEmail = 'admin2@minimalltd.test';
      await request(app)
        .post('/api/v1/auth/register-company-email-otp/send')
        .send({ email: otherEmail });
      const verifyRes2 = await request(app)
        .post('/api/v1/auth/register-company-email-otp/verify')
        .send({
          email: otherEmail,
          code: '654321',
        });
      const otherToken = verifyRes2.body.data.emailVerificationToken;

      const body2 = buildMinimalCompanyRegistrationBody(otherToken, otherEmail);
      const regRes2 = await request(app)
        .post('/api/v1/auth/register-company-request')
        .send(body2);
      expect(regRes2.status).toBe(201);
      expect(regRes2.body.data.status).toBe('approved');
      // Slug should be unique (different from qa-minimal-co)
      expect(regRes2.body.data.tenantSlug).not.toBe('qa-minimal-co');
      expect(regRes2.body.data.tenantSlug).toContain('qa-minimal-co-');
    }, 90000);
  });

  describe('Scenario 3: Key Skills Freezing', () => {
    let tenantSlug = 'qa-skills-co';
    let tenantId: string;
    let jobRow: any;
    let candidateToken: string;

    beforeEach(async () => {
      // 1. Create a tenant workspace
      const tenant = await prisma.tenant.create({
        data: {
          name: 'QA Skills Co',
          slug: tenantSlug,
        },
      });
      tenantId = tenant.id;

      // 2. Create a Job in that tenant
      jobRow = await prisma.job.create({
        data: {
          tenantId,
          title: 'QA Engineer',
          description: 'Testing keys skills freezing logic',
          status: 'open',
        },
      });

      // 3. Register a Candidate
      const registerRes = await request(app)
        .post('/api/v1/portal/auth/registerCandidate')
        .send({
          tenantSlug,
          firstName: 'QA',
          lastName: 'Candidate',
          email: QA_CANDIDATE_EMAIL,
          password: 'CandidateA1aaaa',
        });
      expect(registerRes.status).toBe(201);

      const loginRes = await request(app)
        .post('/api/v1/portal/auth/loginCandidate')
        .send({
          tenantSlug,
          email: QA_CANDIDATE_EMAIL,
          password: 'CandidateA1aaaa',
        });
      expect(loginRes.status).toBe(200);
      candidateToken = loginRes.body.data.accessToken;

      // 4. Update Candidate skills initially
      const patchRes0 = await request(app)
        .patch('/api/v1/portal/profile')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ skills: ['Jest', 'TypeScript'] });
      expect(patchRes0.status).toBe(200);
    });

    it('should freeze candidate key skills on job application', async () => {
      // Apply to Job with required resumeUrl
      const applyRes = await request(app)
        .post(`/api/v1/portal/${tenantSlug}/jobs/${jobRow.id}/apply`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ 
          resumeUrl: 'https://example.com/resume.pdf',
          coverLetter: 'Testing skills' 
        });
      expect(applyRes.status).toBe(201);

      // Verify skills recorded on candidate inside company tenant is ['Jest', 'TypeScript']
      const companyCandidate = await prisma.candidate.findFirst({
        where: { email: QA_CANDIDATE_EMAIL, tenantId },
      });
      expect(companyCandidate?.skills).toEqual(['Jest', 'TypeScript']);

      // Update Profile Key Skills to something else (e.g. ['Jest', 'TypeScript', 'Playwright'])
      const updateRes = await request(app)
        .patch('/api/v1/portal/profile')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ skills: ['Jest', 'TypeScript', 'Playwright'] });
      expect(updateRes.status).toBe(200);

      // Verify Candidate record in company tenant STILL holds frozen ['Jest', 'TypeScript']
      const companyCandidatePostUpdate = await prisma.candidate.findFirst({
        where: { email: QA_CANDIDATE_EMAIL, tenantId },
      });
      expect(companyCandidatePostUpdate?.skills).toEqual(['Jest', 'TypeScript']);

      // Verify Candidate master profile holds updated skills ['Jest', 'TypeScript', 'Playwright']
      const masterTenant = await prisma.tenant.findFirst({
        where: { slug: 'kofeko-candidates' },
      });
      if (masterTenant) {
        const masterCandidate = await prisma.candidate.findFirst({
          where: { email: QA_CANDIDATE_EMAIL, tenantId: masterTenant.id },
        });
        expect(masterCandidate?.skills).toEqual(['Jest', 'TypeScript', 'Playwright']);
      }
    }, 60000);
  });
});
