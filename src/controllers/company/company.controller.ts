import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { companyService } from '../../services/company/company.service';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const registerCompany = catchAsync(async (req: Request, res: Response) => {
  const companyInput = getRequestBody<CreateCompanyInput>(req);
  const company = await companyService.createCompany(companyInput);

  sendSuccess(res, StatusCodes.CREATED, 'Company registered successfully', company);
});

export const getCompany = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const companyId = requireStringValue(params.id, 'companyId');
  const company = await companyService.getCompanyById(companyId);

  sendSuccess(res, StatusCodes.OK, 'Company fetched successfully', company);
});

export const updateCompany = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const companyId = requireStringValue(params.id, 'companyId');
  const companyInput = getRequestBody<UpdateCompanyInput>(req);
  const company = await companyService.updateCompany(companyId, companyInput);

  sendSuccess(res, StatusCodes.OK, 'Company updated successfully', company);
});
