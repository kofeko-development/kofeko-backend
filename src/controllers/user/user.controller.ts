import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { userService } from '../../services/user/user.service';
import { CreateUserInput, InviteUserInput, UpdateUserInput } from '../../types/user/user.types';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const userInput = getRequestBody<CreateUserInput>(req);
  const result = await userService.createUser(userInput);

  sendSuccess(res, StatusCodes.CREATED, 'User created successfully', result);
});

export const inviteUser = catchAsync(async (req: Request, res: Response) => {
  const userInput = getRequestBody<InviteUserInput>(req);
  const result = await userService.inviteUser(userInput);

  sendSuccess(res, StatusCodes.CREATED, 'User invited successfully', result);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const userId = requireStringValue(params.id, 'userId');
  const result = await userService.getUserById(userId);

  sendSuccess(res, StatusCodes.OK, 'User fetched successfully', result);
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const tenantId = requireStringValue(query.tenantId, 'tenantId');
  const result = await userService.listUsersByTenant(tenantId);

  sendSuccess(res, StatusCodes.OK, 'Users fetched successfully', result);
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const userId = requireStringValue(params.id, 'userId');
  const userInput = getRequestBody<UpdateUserInput>(req);
  const result = await userService.updateUser(userId, userInput);

  sendSuccess(res, StatusCodes.OK, 'User updated successfully', result);
});
