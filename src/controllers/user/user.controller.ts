import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { userService } from '../../services/user/user.service';
import { CreateUserInput, InviteUserInput, UpdateUserInput } from '../../types/user/user.types';

const sanitizeUser = <T extends { passwordHash?: string }>(user: T) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const userInput = getRequestBody<CreateUserInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await userService.createUser({ ...userInput, tenantId });

  sendSuccess(res, StatusCodes.CREATED, 'User created successfully', sanitizeUser(result));
});

export const inviteUser = catchAsync(async (req: Request, res: Response) => {
  const userInput = getRequestBody<InviteUserInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await userService.inviteUser({ ...userInput, tenantId, actorId });

  sendSuccess(res, StatusCodes.CREATED, 'User invited successfully', sanitizeUser(result));
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const userId = requireStringValue(params.id, 'userId');
  const tenantId = String(req.user?.tenantId);
  const result = await userService.getUserById(userId, tenantId);

  sendSuccess(res, StatusCodes.OK, 'User fetched successfully', sanitizeUser(result));
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const result = await userService.listUsersByTenant(tenantId);

  sendSuccess(res, StatusCodes.OK, 'Users fetched successfully', result.map(sanitizeUser));
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const userId = requireStringValue(params.id, 'userId');
  const userInput = getRequestBody<UpdateUserInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await userService.updateUser(userId, tenantId, userInput);

  sendSuccess(res, StatusCodes.OK, 'User updated successfully', sanitizeUser(result));
});
