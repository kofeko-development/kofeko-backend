import { StatusCodes } from 'http-status-codes';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { uploadFile } from '../../common/storage/fileUpload';
import { cacheService } from '../../common/cache/cacheService';
import { eventBus } from '../../common/events/eventBus';
import { DEMO_EMAIL_DOMAIN, DEMO_SOURCE, type DemoCandidate } from '../../common/constants/demoCandidates';

export function canImportDemoCandidates(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = env.DEMO_IMPORT_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

function assertAllowed(email: string | undefined) {
  if (!canImportDemoCandidates(email)) {
    throw new AppError('Demo import is not enabled for this account', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }
}

const demoCandidateWhere = (tenantId: string) => ({
  tenantId,
  source: DEMO_SOURCE,
  email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
});

async function refreshJobViews(tenantId: string, jobId: string) {
  await cacheService.invalidateTenantPipelines(tenantId, jobId);
  await cacheService.invalidateJob(tenantId, jobId);
  eventBus.emitTyped('job:applications_updated', { tenantId, jobId });
}

export const demoCandidatesService = {
  /**
   * Creates (or refreshes) the demo candidates in this tenant from an uploaded pack.
   * Resumes live only in storage/DB, never in the repo.
   */
  async installPack(
    tenantId: string,
    userEmail: string | undefined,
    pack: DemoCandidate[],
    files: { originalname: string; buffer: Buffer; mimetype: string }[],
  ) {
    assertAllowed(userEmail);
    const fileByName = new Map(files.map((f) => [f.originalname, f]));
    const missing = pack.filter((c) => !fileByName.has(c.resumeFile)).map((c) => c.resumeFile);
    if (missing.length) {
      throw new AppError(`Missing resume files: ${missing.join(', ')}`, StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    const invalid = pack.filter((c) => !c.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`) || !c.firstName || !c.lastName);
    if (invalid.length) {
      throw new AppError(`Demo candidates need a name and an @${DEMO_EMAIL_DOMAIN} email`, StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    for (const c of pack) {
      const file = fileByName.get(c.resumeFile)!;
      const resumeUrl = await uploadFile(file.buffer, c.resumeFile, 'application/pdf');
      const profile = {
        firstName: c.firstName,
        lastName: c.lastName,
        resumeUrl,
        resumeMimeType: 'application/pdf',
        source: DEMO_SOURCE,
        summary: c.summary || null,
        skills: c.skills ?? [],
        location: c.location,
        currentCompany: c.currentCompany,
        yearsOfExperience: c.yearsOfExperience,
        linkedinUrl: c.linkedinUrl,
        portfolioUrl: c.portfolioUrl,
        workExperience: (c.workExperience ?? []) as Prisma.InputJsonValue,
        education: (c.education ?? []) as Prisma.InputJsonValue,
        projects: (c.projects ?? []) as Prisma.InputJsonValue,
        hobbies: c.hobbies ?? [],
      };
      await prisma.candidate.upsert({
        where: { tenantId_email: { tenantId, email: c.email } },
        create: { tenantId, email: c.email, ...profile },
        update: profile,
      });
    }

    await cacheService.invalidateCandidatesList(tenantId);
    return { installed: pack.length };
  },

  /** Applies every installed demo candidate to the job. */
  async importToJob(tenantId: string, jobId: string, userEmail: string | undefined) {
    assertAllowed(userEmail);
    const job = await prisma.job.findFirst({ where: { id: jobId, tenantId }, select: { status: true } });
    if (!job) throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    if (job.status !== 'open') {
      throw new AppError('Publish the job before importing demo candidates', StatusCodes.BAD_REQUEST, ERROR_CODES.JOB_NOT_OPEN);
    }

    const demo = await prisma.candidate.findMany({
      where: demoCandidateWhere(tenantId),
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (demo.length === 0) {
      throw new AppError('No demo candidates are installed for this company yet', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // Stagger application times over the last few days so the pipeline looks natural
    const now = Date.now();
    const result = await prisma.pipeline.createMany({
      data: demo.map((c, i) => ({
        tenantId,
        jobId,
        candidateId: c.id,
        stage: 'applied',
        createdAt: new Date(now - (i * 5 + 1) * 3_600_000),
      })),
      skipDuplicates: true,
    });

    await refreshJobViews(tenantId, jobId);
    return { added: result.count, alreadyApplied: demo.length - result.count, total: demo.length };
  },

  /** Removes the demo candidates' applications (and AI evaluations) from the job, to reset a demo. */
  async removeFromJob(tenantId: string, jobId: string, userEmail: string | undefined) {
    assertAllowed(userEmail);
    const demo = await prisma.candidate.findMany({ where: demoCandidateWhere(tenantId), select: { id: true } });
    const candidateId = { in: demo.map((c) => c.id) };
    const [, removed] = await prisma.$transaction([
      prisma.evaluation.deleteMany({ where: { tenantId, jobId, candidateId } }),
      prisma.pipeline.deleteMany({ where: { tenantId, jobId, candidateId } }),
    ]);

    await refreshJobViews(tenantId, jobId);
    return { removed: removed.count };
  },
};
