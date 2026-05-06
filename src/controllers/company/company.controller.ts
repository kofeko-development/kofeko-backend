import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { companyService } from '../../services/company/company.service';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const registerCompany = catchAsync(async (req: Request, res: Response) => {
  const companyInput = getRequestBody<CreateCompanyInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const profile = await companyService.createCompany(tenantId, companyInput, actorId);

  sendSuccess(res, StatusCodes.CREATED, 'Company registered successfully', profile);
});

export const getCompany = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const profile = await companyService.getCompanyProfileByTenantId(tenantId);

  sendSuccess(res, StatusCodes.OK, 'Company fetched successfully', profile);
});

export const updateCompany = catchAsync(async (req: Request, res: Response) => {
  const companyInput = getRequestBody<UpdateCompanyInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const profile = await companyService.updateCompanyByTenantId(tenantId, companyInput, actorId);

  sendSuccess(res, StatusCodes.OK, 'Company updated successfully', profile);
});
