import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
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
  const { page, limit, entityType, entityId, action, actorId } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await auditService.listAuditLogs(
    tenantId,
    {
      entityType: entityType ? String(entityType) : undefined,
      entityId: entityId ? String(entityId) : undefined,
      action: action ? String(action) : undefined,
      actorId: actorId ? String(actorId) : undefined,
    },
    pagination,
  );
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const getAuditLog = catchAsync(async (req: Request, res: Response) => {
  const auditLogId = requireStringValue(req.params.id, 'auditLogId');
  const tenantId = String(req.user?.tenantId);
  const result = await auditService.getAuditLogById(auditLogId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Audit log fetched successfully', result);
});
