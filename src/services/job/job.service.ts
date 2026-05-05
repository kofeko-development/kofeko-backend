import { Job } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { jobRepository } from '../../repositories/job/job.repository';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';
import { PaginationInput } from '../../common/utils/pagination';

export const jobService = {
  async createJob(payload: CreateJobInput, actorId?: string): Promise<Job> {
    const job = await jobRepository.create(payload);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'create',
      actorId,
      entityType: 'Job',
      entityId: job.id,
      metadata: { title: job.title, status: job.status },
    });
    return job;
  },

  async getJobById(id: string, tenantId: string): Promise<Job> {
    const job = await jobRepository.findByIdAndTenant(id, tenantId);
    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return job;
  },

  async listJobsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Job[]; total: number }> {
    return jobRepository.listByTenant(tenantId, pagination.page, pagination.limit);
  },

  async updateJob(id: string, tenantId: string, payload: UpdateJobInput, actorId?: string): Promise<Job> {
    const currentJob = await this.getJobById(id, tenantId);
    const updatedJob = await jobRepository.updateByIdAndTenant(id, tenantId, payload);
    await auditService.createAuditLog({
      tenantId: currentJob.tenantId,
      action: 'update',
      actorId,
      entityType: 'Job',
      entityId: updatedJob.id,
      metadata: { before: currentJob, after: updatedJob },
    });
    return updatedJob;
  },
};
