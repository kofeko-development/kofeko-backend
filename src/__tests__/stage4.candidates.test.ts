import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

jest.mock('../common/storage/fileUpload', () => ({
  uploadFile: jest.fn(async () => 'http://localhost:5000/uploads/mock.pdf'),
}));

describe('Stage 4: candidates + resume upload', () => {
  it('creates candidate with status new, blocks duplicate email, lists with filters, updates resume, changes status with audit, uploads resume', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register-admin').send({
      tenantName: 'Acme',
      tenantSlug: 'acme-stage4',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin-stage4@acme.com',
      password: 'AdminA1aaaa',
    });

    expect(registerRes.status).toBe(201);
    const { accessToken, tenant } = registerRes.body.data as { accessToken: string; tenant: { id: string } };

    const createRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@acme.com',
        skills: ['React', 'Node'],
        source: 'linkedin',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('new');
    const candidateId = String(createRes.body.data.id);

    const dupRes = await request(app)
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Jane2',
        lastName: 'Doe2',
        email: 'jane@acme.com',
      });
    expect(dupRes.status).toBe(409);

    const getRes = await request(app)
      .get(`/api/v1/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.email).toBe('jane@acme.com');
    expect(getRes.body.data.skills).toEqual(['React', 'Node']);

    const listByStatus = await request(app)
      .get('/api/v1/candidates?status=new&page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listByStatus.status).toBe(200);
    expect(Array.isArray(listByStatus.body.data.items)).toBe(true);

    const listBySkills = await request(app)
      .get('/api/v1/candidates?skills=React,Python&page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listBySkills.status).toBe(200);
    const ids = (listBySkills.body.data.items as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain(candidateId);

    const patchRes = await request(app)
      .patch(`/api/v1/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        location: 'Remote',
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.location).toBe('Remote');
    expect(patchRes.body.data.email).toBe('jane@acme.com');

    const patchResume = await request(app)
      .patch(`/api/v1/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        resumeUrl: 'http://localhost:5000/uploads/resume.pdf',
        resumeMimeType: 'application/pdf',
      });
    expect(patchResume.status).toBe(200);
    expect(patchResume.body.data.resumeUrl).toBe('http://localhost:5000/uploads/resume.pdf');
    expect(patchResume.body.data.resumeMimeType).toBe('application/pdf');

    const statusRes = await request(app)
      .patch(`/api/v1/candidates/${candidateId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'screening' });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('screening');

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: tenant.id, entityType: 'candidate', entityId: candidateId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect((audit?.metadata as any)?.from).toBe('new');
    expect((audit?.metadata as any)?.to).toBe('screening');

    const uploadOk = await request(app)
      .post('/api/v1/candidates/upload-resume')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('resume', Buffer.from('fakepdf'), { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(uploadOk.status).toBe(200);
    expect(uploadOk.body.data.mimeType).toBe('application/pdf');
    expect(uploadOk.body.data.url).toContain('/uploads/');

    const uploadBad = await request(app)
      .post('/api/v1/candidates/upload-resume')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('resume', Buffer.from('fakejpg'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(uploadBad.status).toBe(415);
  });
});

