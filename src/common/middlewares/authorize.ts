import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const authorize = (requiredPermissions: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError('Unauthorized', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
      return;
    }

    const mappings = await prisma.userRole.findMany({
      where: {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const userPermissions = new Set(
      mappings.flatMap((mapping) => mapping.role.rolePermissions.map((item) => item.permission.key)),
    );

    const isAllowed = requiredPermissions.every((permission) => userPermissions.has(permission));

    if (!isAllowed) {
      next(new AppError("You don't have permission to do this", StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN));
      return;
    }

    next();
  };
};
