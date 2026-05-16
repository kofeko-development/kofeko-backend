import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { companyService } from '../../services/company/company.service';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';
import { uploadFile } from '../../common/storage/fileUpload';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

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

export const uploadLogo = catchAsync(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new AppError('Logo file is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  const allowed = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]);

  if (!allowed.has(file.mimetype)) {
    throw new AppError('Unsupported format. Use JPG, PNG, GIF, WEBP or SVG.', StatusCodes.UNSUPPORTED_MEDIA_TYPE, ERROR_CODES.VALIDATION_ERROR);
  }

  const maxBytes = 5 * 1024 * 1024; // 5MB for logo
  if (file.size > maxBytes) {
    throw new AppError('File is too large (max 5 MB).', StatusCodes.REQUEST_TOO_LONG, ERROR_CODES.VALIDATION_ERROR);
  }

  const url = await uploadFile(file.buffer, file.originalname, file.mimetype);
  sendSuccess(res, StatusCodes.OK, 'Logo uploaded successfully', {
    url,
    mimeType: file.mimetype,
    filename: file.originalname,
  });
});
