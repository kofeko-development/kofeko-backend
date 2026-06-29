import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';

export const superAdminGetAutoApproveSetting = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_approve_company' },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        autoApprove: setting?.value === 'true',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const superAdminSetAutoApproveSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { enabled } = req.body;

    const setting = await prisma.systemSetting.upsert({
      where: { key: 'auto_approve_company' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'auto_approve_company', value: enabled ? 'true' : 'false' },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        autoApprove: setting.value === 'true',
      },
    });
  } catch (error) {
    next(error);
  }
};
