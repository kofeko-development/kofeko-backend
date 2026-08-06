import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { systemService } from '../../services/system/system.service';

export const getSeedStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await systemService.getSeedStatus();
  sendSuccess(res, StatusCodes.OK, 'Seed status fetched successfully', status);
});

export const submitContactForm = catchAsync(async (req: Request, res: Response) => {
  await systemService.processContactInquiry(req.body);
  sendSuccess(res, StatusCodes.OK, 'Contact inquiry sent successfully', {});
});
