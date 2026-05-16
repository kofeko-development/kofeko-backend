import { Job } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { jobRepository } from '../../repositories/job/job.repository';
import { companyRepository } from '../../repositories/company/company.repository';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';
import { PaginationInput } from '../../common/utils/pagination';

export const jobService = {
  async createJob(payload: CreateJobInput, actorId?: string): Promise<Job> {
    let location = payload.location;
    if (!location) {
      const company = await companyRepository.findByTenantId(payload.tenantId);
      if (company?.officialCompanyAddress) {
        location = company.officialCompanyAddress;
      }
    }

    const job = await jobRepository.create({
      ...payload,
      location,
      status: 'draft',
    });
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

  async listJobsByTenant(
    tenantId: string,
    input: PaginationInput & { status?: Job['status']; department?: string },
  ): Promise<{ items: Job[]; total: number }> {
    return jobRepository.listByTenant(tenantId, {
      page: input.page,
      limit: input.limit,
      status: input.status,
      department: input.department,
    });
  },

  async updateJob(id: string, tenantId: string, payload: UpdateJobInput, actorId?: string): Promise<Job> {
    const currentJob = await this.getJobById(id, tenantId);
    if (currentJob.status === 'closed') {
      throw new AppError(
        'Closed jobs cannot be edited. Create a new job instead.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.JOB_IS_CLOSED,
      );
    }
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

  async publishJob(id: string, tenantId: string, actorId?: string): Promise<Job> {
    const currentJob = await this.getJobById(id, tenantId);
    if (currentJob.status === 'closed') {
      throw new AppError(
        'Closed jobs cannot be reopened. Create a new job if you want to hire for this role again.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.JOB_IS_CLOSED,
      );
    }
    if (currentJob.status === 'open') return currentJob;
    const updated = await jobRepository.updateByIdAndTenant(id, tenantId, { status: 'open' } satisfies { status: Job['status'] });
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Job',
      entityId: updated.id,
      metadata: { beforeStatus: currentJob.status, afterStatus: updated.status },
    });
    return updated;
  },

  async pauseJob(id: string, tenantId: string, actorId?: string): Promise<Job> {
    const currentJob = await this.getJobById(id, tenantId);
    if (currentJob.status !== 'open') {
      throw new AppError('Only open jobs can be paused', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    const updated = await jobRepository.updateByIdAndTenant(id, tenantId, { status: 'paused' } satisfies { status: Job['status'] });
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Job',
      entityId: updated.id,
      metadata: { beforeStatus: currentJob.status, afterStatus: updated.status },
    });
    return updated;
  },

  async closeJob(id: string, tenantId: string, actorId?: string): Promise<Job> {
    const currentJob = await this.getJobById(id, tenantId);
    if (currentJob.status === 'closed') return currentJob;
    const updated = await jobRepository.updateByIdAndTenant(id, tenantId, { status: 'closed' } satisfies { status: Job['status'] });
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Job',
      entityId: updated.id,
      metadata: { beforeStatus: currentJob.status, afterStatus: updated.status },
    });
    return updated;
  },

  async deleteJob(id: string, tenantId: string, actorId?: string): Promise<void> {
    const job = await this.getJobById(id, tenantId);
    if (job.status !== 'draft') {
      throw new AppError(
        'Only draft jobs can be deleted. Publish jobs must be closed first.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    await jobRepository.deleteByIdAndTenant(id, tenantId);
    await auditService.createAuditLog({
      tenantId,
      action: 'delete',
      actorId,
      entityType: 'Job',
      entityId: id,
      metadata: { title: job.title },
    });
  },
};
