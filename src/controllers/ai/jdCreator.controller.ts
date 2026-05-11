import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { jdCreatorService } from '../../services/ai/jdCreator.service';

export const generateJd = catchAsync(async (req: Request, res: Response) => {
  const input = getRequestBody<{
    jobTitle: string;
    requirements: string;
    location?: string;
    jobType?: string;
    employmentType?: string;
  }>(req);

  const result = await jdCreatorService.generateJobDescription(input);
  sendSuccess(res, StatusCodes.OK, 'Job description generated', result);
});

