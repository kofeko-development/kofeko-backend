import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../common/utils/apiResponse';
import { catchAsync } from '../../common/utils/catchAsync';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { rbacService } from '../../services/rbac/rbac.service';
import {
  AssignRoleToUserInput,
  AttachPermissionToRoleInput,
  CreatePermissionInput,
  CreateRoleInput,
} from '../../types/rbac/rbac.types';

export const createRole = catchAsync(async (req: Request, res: Response) => {
  const roleInput = getRequestBody<CreateRoleInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await rbacService.createRole({ ...roleInput, tenantId });

  sendSuccess(res, StatusCodes.CREATED, 'Role created successfully', result);
});

export const createPermission = catchAsync(async (req: Request, res: Response) => {
  const permissionInput = getRequestBody<CreatePermissionInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await rbacService.createPermission({ ...permissionInput, tenantId });

  sendSuccess(res, StatusCodes.CREATED, 'Permission created successfully', result);
});

export const attachPermissionToRole = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const tenantId = String(req.user?.tenantId);
  const roleId = requireStringValue(params.roleId, 'roleId');
  const permissionId = requireStringValue(params.permissionId, 'permissionId');
  const payload: AttachPermissionToRoleInput = {
    tenantId,
    roleId,
    permissionId,
  };

  const result = await rbacService.attachPermissionToRole(payload);

  sendSuccess(res, StatusCodes.CREATED, 'Permission attached to role successfully', result);
});

export const assignRoleToUser = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const tenantId = String(req.user?.tenantId);
  const userId = requireStringValue(params.userId, 'userId');
  const roleId = requireStringValue(params.roleId, 'roleId');
  const payload: AssignRoleToUserInput = {
    tenantId,
    userId,
    roleId,
  };

  const result = await rbacService.assignRoleToUser(payload);

  sendSuccess(res, StatusCodes.CREATED, 'Role assigned to user successfully', result);
});

export const getUserPermissions = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const tenantId = String(req.user?.tenantId);
  const userId = requireStringValue(params.userId, 'userId');
  const result = await rbacService.getUserPermissions(tenantId, userId);

  sendSuccess(res, StatusCodes.OK, 'User permissions fetched successfully', result);
});
