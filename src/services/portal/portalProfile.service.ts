import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { cacheService } from '../../common/cache/cacheService';

export const portalProfileService = {
  async updateProfile(
    candidateId: string,
    tenantId: string,
    payload: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      linkedinUrl?: string;
      portfolioUrl?: string;
      expectedSalary?: number;
      noticePeriod?: number;
      skills?: string[];
      location?: string;
      summary?: string;
      education?: any[];
      workExperience?: any[];
      projects?: any[];
      hobbies?: string[];
    },
  ) {
    const currentCandidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { email: true }
    });

    if (!currentCandidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (payload.phone) {
      const existing = await prisma.candidate.findFirst({
        where: {
          phoneNumber: payload.phone,
          email: { not: currentCandidate.email },
        },
      });

      if (existing) {
        throw new AppError('This phone number is already registered to another candidate.', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
      }
    }

    const updated = await prisma.candidate.updateMany({
      where: { email: currentCandidate.email },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phoneNumber: payload.phone,
        linkedinUrl: payload.linkedinUrl,
        portfolioUrl: payload.portfolioUrl,
        expectedSalary: payload.expectedSalary,
        noticePeriod: payload.noticePeriod,
        skills: payload.skills,
        location: payload.location,
        summary: payload.summary,
        education: payload.education,
        workExperience: payload.workExperience,
        projects: payload.projects,
        hobbies: payload.hobbies,
      },
    });

    if (updated.count === 0) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // Invalidate the session for the current candidate login
    await cacheService.invalidateCandidateSession(tenantId, candidateId);

    return prisma.candidate.findFirstOrThrow({
      where: { id: candidateId, tenantId },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        resumeUrl: true,
        resumeMimeType: true,
        linkedinUrl: true,
        portfolioUrl: true,
        expectedSalary: true,
        noticePeriod: true,
        skills: true,
        location: true,
        summary: true,
        education: true,
        workExperience: true,
        projects: true,
        hobbies: true,
        yearsOfExperience: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
};

