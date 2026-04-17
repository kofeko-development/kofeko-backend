import { Job } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { jobRepository } from '../../repositories/job/job.repository';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';
import { PaginationInput } from '../../common/utils/pagination';

export const jobService = {
  async createJob(payload: CreateJobInput): Promise<Job> {
    const job = await jobRepository.create(payload);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'create',
      entityType: 'Job',
      entityId: job.id,
      metadata: { title: job.title, status: job.status },
    });
    return job;
  },

  async getJobById(id: string): Promise<Job> {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return job;
  },

  async listJobsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Job[]; total: number }> {
    return jobRepository.listByTenant(tenantId, pagination.page, pagination.limit);
  },

  async updateJob(id: string, payload: UpdateJobInput): Promise<Job> {
    const currentJob = await this.getJobById(id);
    const updatedJob = await jobRepository.updateById(id, payload);
    await auditService.createAuditLog({
      tenantId: currentJob.tenantId,
      action: 'update',
      entityType: 'Job',
      entityId: updatedJob.id,
      metadata: { before: currentJob, after: updatedJob },
    });
    return updatedJob;
  },
};
