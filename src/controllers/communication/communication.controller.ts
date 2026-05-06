import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { communicationService } from '../../services/communication/communication.service';
import { CreateMessageInput, CreateNotificationInput, ManualSendMessageInput } from '../../types/communication/communication.types';

export const createNotification = catchAsync(async (req: Request, res: Response) => {
  const notificationInput = getRequestBody<CreateNotificationInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await communicationService.createNotification({ ...notificationInput, tenantId });
  sendSuccess(res, StatusCodes.CREATED, 'Notification created successfully', result);
});

export const listNotifications = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await communicationService.listNotificationsByTenant(tenantId, pagination);
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  });
});

export const listUnreadNotifications = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await communicationService.listUnreadNotificationsByTenant(tenantId, pagination);
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  });
});

export const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const notificationId = requireStringValue(params.id, 'notificationId');
  const tenantId = String(req.user?.tenantId);
  const result = await communicationService.markNotificationAsRead(notificationId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Notification marked as read', result);
});

export const createMessage = catchAsync(async (req: Request, res: Response) => {
  const messageInput = getRequestBody<CreateMessageInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await communicationService.createMessage({ ...messageInput, tenantId });
  sendSuccess(res, StatusCodes.CREATED, 'Message created successfully', result);
});

export const listMessages = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await communicationService.listMessagesByTenant(tenantId, pagination);
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  });
});

export const sendManualMessage = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<ManualSendMessageInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await communicationService.sendManualMessage(tenantId, payload, actorId);
  sendSuccess(res, StatusCodes.CREATED, 'Message sent successfully', result);
});
