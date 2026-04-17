import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { communicationService } from '../../services/communication/communication.service';
import { CreateMessageInput, CreateNotificationInput } from '../../types/communication/communication.types';

export const createNotification = catchAsync(async (req: Request, res: Response) => {
  const notificationInput = getRequestBody<CreateNotificationInput>(req);
  const result = await communicationService.createNotification(notificationInput);
  sendSuccess(res, StatusCodes.CREATED, 'Notification created successfully', result);
});

export const listNotifications = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = requireStringValue(query.tenantId, 'tenantId');
  const result = await communicationService.listNotificationsByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Notifications fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});

export const listUnreadNotifications = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = requireStringValue(query.tenantId, 'tenantId');
  const result = await communicationService.listUnreadNotificationsByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Unread notifications fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});

export const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const notificationId = requireStringValue(params.id, 'notificationId');
  const result = await communicationService.markNotificationAsRead(notificationId);
  sendSuccess(res, StatusCodes.OK, 'Notification marked as read', result);
});

export const createMessage = catchAsync(async (req: Request, res: Response) => {
  const messageInput = getRequestBody<CreateMessageInput>(req);
  const result = await communicationService.createMessage(messageInput);
  sendSuccess(res, StatusCodes.CREATED, 'Message created successfully', result);
});

export const listMessages = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = requireStringValue(query.tenantId, 'tenantId');
  const result = await communicationService.listMessagesByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Messages fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});
