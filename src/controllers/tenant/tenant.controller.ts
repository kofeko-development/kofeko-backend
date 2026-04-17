import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { tenantService } from '../../services/tenant/tenant.service';
import { CreateTenantInput, UpdateTenantInput } from '../../types/tenant/tenant.types';

export const createTenant = catchAsync(async (req: Request, res: Response) => {
  const tenantInput = getRequestBody<CreateTenantInput>(req);
  const result = await tenantService.createTenant(tenantInput);

  sendSuccess(res, StatusCodes.CREATED, 'Tenant created successfully', result);
});

export const getTenant = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const tenantId = requireStringValue(params.id, 'tenantId');
  const result = await tenantService.getTenantById(tenantId);

  sendSuccess(res, StatusCodes.OK, 'Tenant fetched successfully', result);
});

export const updateTenant = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const tenantId = requireStringValue(params.id, 'tenantId');
  const tenantInput = getRequestBody<UpdateTenantInput>(req);
  const result = await tenantService.updateTenant(tenantId, tenantInput);

  sendSuccess(res, StatusCodes.OK, 'Tenant updated successfully', result);
});
