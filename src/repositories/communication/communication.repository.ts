import { Message, Notification } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { CreateMessageInput, CreateNotificationInput } from '../../types/communication/communication.types';

export const communicationRepository = {
  async findNotificationByIdAndTenant(id: string, tenantId: string): Promise<Notification | null> {
    return prisma.notification.findFirst({ where: { id, tenantId } });
  },

  async createNotification(data: CreateNotificationInput): Promise<Notification> {
    return prisma.notification.create({ data });
  },

  async listNotificationsByTenant(tenantId: string, page: number, limit: number): Promise<{ items: Notification[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async listUnreadNotificationsByTenant(tenantId: string, page: number, limit: number): Promise<{ items: Notification[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          tenantId,
          status: 'queued',
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({
        where: {
          tenantId,
          status: 'queued',
        },
      }),
    ]);

    return { items, total };
  },

  async markNotificationAsSent(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });
  },

  async markNotificationAsRead(id: string, tenantId: string): Promise<Notification> {
    const current = await prisma.notification.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('Notification not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return prisma.notification.update({
      where: { id: current.id },
      data: {
        status: 'read',
      },
    });
  },

  async createMessage(data: CreateMessageInput): Promise<Message> {
    return prisma.message.create({ data });
  },

  async listMessagesByTenant(tenantId: string, page: number, limit: number): Promise<{ items: Message[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },
};
