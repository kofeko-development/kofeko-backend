import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { auditService } from '../../services/audit/audit.service';
import { CreateAuditLogInput } from '../../types/audit/audit.types';

export const createAuditLog = catchAsync(async (req: Request, res: Response) => {
  const auditLogInput = getRequestBody<CreateAuditLogInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await auditService.createAuditLog({ ...auditLogInput, tenantId, actorId });
  sendSuccess(res, StatusCodes.CREATED, 'Audit log created successfully', result);
});

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await auditService.listAuditLogsByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Audit logs fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});
