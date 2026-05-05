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
  const company = await companyService.createCompany(tenantId, companyInput);

  sendSuccess(res, StatusCodes.CREATED, 'Company registered successfully', company);
});

export const getCompany = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const company = await companyService.getCompanyByTenantId(tenantId);

  sendSuccess(res, StatusCodes.OK, 'Company fetched successfully', company);
});

export const updateCompany = catchAsync(async (req: Request, res: Response) => {
  const companyInput = getRequestBody<UpdateCompanyInput>(req);
  const tenantId = String(req.user?.tenantId);
  const company = await companyService.updateCompanyByTenantId(tenantId, companyInput);

  sendSuccess(res, StatusCodes.OK, 'Company updated successfully', company);
});
