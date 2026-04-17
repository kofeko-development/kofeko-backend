import { Message, Notification } from '@prisma/client';
import { communicationRepository } from '../../repositories/communication/communication.repository';
import { CreateMessageInput, CreateNotificationInput, PipelineStageNotificationInput } from '../../types/communication/communication.types';
import { PaginationInput } from '../../common/utils/pagination';

export const communicationService = {
  async createNotification(payload: CreateNotificationInput): Promise<Notification> {
    return communicationRepository.createNotification(payload);
  },

  async listNotificationsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Notification[]; total: number }> {
    return communicationRepository.listNotificationsByTenant(tenantId, pagination.page, pagination.limit);
  },

  async listUnreadNotificationsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Notification[]; total: number }> {
    return communicationRepository.listUnreadNotificationsByTenant(tenantId, pagination.page, pagination.limit);
  },

  async markNotificationAsRead(id: string): Promise<Notification> {
    return communicationRepository.markNotificationAsRead(id);
  },

  async createMessage(payload: CreateMessageInput): Promise<Message> {
    return communicationRepository.createMessage(payload);
  },

  async notifyPipelineStageChange(payload: PipelineStageNotificationInput): Promise<Notification> {
    const notification = await communicationRepository.createNotification({
      tenantId: payload.tenantId,
      channel: 'in_app',
      recipient: payload.recipient,
      title: `Application moved to ${payload.stage}`,
      body: `${payload.candidateName} is now in the ${payload.stage} stage for ${payload.jobTitle}.`,
      status: 'queued',
    });

    return communicationRepository.markNotificationAsSent(notification.id);
  },

  async listMessagesByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Message[]; total: number }> {
    return communicationRepository.listMessagesByTenant(tenantId, pagination.page, pagination.limit);
  },
};
