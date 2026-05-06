import { Message, Notification } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { communicationRepository } from '../../repositories/communication/communication.repository';
import { sendEmail } from '../../common/email/emailProvider';
import { env } from '../../config/env';
import { stageAdvanceEmail } from '../../common/email/templates/stageAdvanceEmail';
import { interviewAssignmentEmail } from '../../common/email/templates/interviewAssignmentEmail';
import { offerEmail } from '../../common/email/templates/offerEmail';
import { rejectionEmail } from '../../common/email/templates/rejectionEmail';
import { auditService } from '../audit/audit.service';
import {
  CreateMessageInput,
  CreateNotificationInput,
  ManualSendMessageInput,
} from '../../types/communication/communication.types';
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

  async markNotificationAsRead(id: string, tenantId: string): Promise<Notification> {
    const notification = await communicationRepository.findNotificationByIdAndTenant(id, tenantId);
    if (!notification) {
      throw new AppError('Notification not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return communicationRepository.markNotificationAsRead(id, tenantId);
  },

  async createMessage(payload: CreateMessageInput): Promise<Message> {
    return communicationRepository.createMessage(payload);
  },

  async sendStageAdvanceNotification(payload: {
    tenantId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    companyName: string;
    newStage: string;
  }): Promise<{ message: Message; notification: Notification }> {
    const tpl = stageAdvanceEmail({
      candidateName: payload.candidateName,
      jobTitle: payload.jobTitle,
      companyName: payload.companyName,
      newStage: payload.newStage,
      portalUrl: `${env.FRONTEND_URL}/portal`,
    });

    try {
      await sendEmail({ to: payload.candidateEmail, subject: tpl.subject, html: tpl.html });

      const message = await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'stage_advance',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.candidateEmail,
        status: 'sent',
        direction: 'outbound',
        sentAt: new Date(),
      });

      const notification = await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'stage_advance',
        recipient: payload.candidateEmail,
        title: tpl.subject,
        body: 'Email sent',
        status: 'sent',
      });

      return { message, notification };
    } catch (err) {
      await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'stage_advance',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.candidateEmail,
        status: 'failed',
        direction: 'outbound',
      });

      await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'stage_advance',
        recipient: payload.candidateEmail,
        title: tpl.subject,
        body: err instanceof Error ? err.message : 'Failed to send email',
        status: 'failed',
      });

      throw err;
    }
  },

  async sendInterviewerAssignmentEmail(payload: {
    tenantId: string;
    interviewerEmail: string;
    interviewerName: string;
    candidateName: string;
    jobTitle: string;
    stage: string;
  }): Promise<{ message: Message; notification: Notification }> {
    const tpl = interviewAssignmentEmail({
      interviewerName: payload.interviewerName,
      candidateName: payload.candidateName,
      jobTitle: payload.jobTitle,
      stage: payload.stage,
      dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
    });

    try {
      await sendEmail({ to: payload.interviewerEmail, subject: tpl.subject, html: tpl.html });

      const message = await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'interview_assignment',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.interviewerEmail,
        status: 'sent',
        direction: 'outbound',
        sentAt: new Date(),
      });

      const notification = await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'interview_assignment',
        recipient: payload.interviewerEmail,
        title: tpl.subject,
        body: 'Email sent',
        status: 'sent',
      });

      return { message, notification };
    } catch (err) {
      await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'interview_assignment',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.interviewerEmail,
        status: 'failed',
        direction: 'outbound',
      });

      await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'interview_assignment',
        recipient: payload.interviewerEmail,
        title: tpl.subject,
        body: err instanceof Error ? err.message : 'Failed to send email',
        status: 'failed',
      });

      throw err;
    }
  },

  async sendOfferNotification(payload: {
    tenantId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    companyName: string;
  }): Promise<{ message: Message; notification: Notification }> {
    const tpl = offerEmail({
      candidateName: payload.candidateName,
      jobTitle: payload.jobTitle,
      companyName: payload.companyName,
      portalUrl: `${env.FRONTEND_URL}/portal`,
    });

    try {
      await sendEmail({ to: payload.candidateEmail, subject: tpl.subject, html: tpl.html });

      const message = await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'offer',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.candidateEmail,
        status: 'sent',
        direction: 'outbound',
        sentAt: new Date(),
      });

      const notification = await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'offer',
        recipient: payload.candidateEmail,
        title: tpl.subject,
        body: 'Email sent',
        status: 'sent',
      });

      return { message, notification };
    } catch (err) {
      await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'offer',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.candidateEmail,
        status: 'failed',
        direction: 'outbound',
      });

      await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'offer',
        recipient: payload.candidateEmail,
        title: tpl.subject,
        body: err instanceof Error ? err.message : 'Failed to send email',
        status: 'failed',
      });

      throw err;
    }
  },

  async sendRejectionEmail(payload: {
    tenantId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    companyName: string;
  }): Promise<{ message: Message; notification: Notification }> {
    const tpl = rejectionEmail({
      candidateName: payload.candidateName,
      jobTitle: payload.jobTitle,
      companyName: payload.companyName,
    });

    try {
      await sendEmail({ to: payload.candidateEmail, subject: tpl.subject, html: tpl.html });

      const message = await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'rejection',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.candidateEmail,
        status: 'sent',
        direction: 'outbound',
        sentAt: new Date(),
      });

      const notification = await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'rejection',
        recipient: payload.candidateEmail,
        title: tpl.subject,
        body: 'Email sent',
        status: 'sent',
      });

      return { message, notification };
    } catch (err) {
      await communicationRepository.createMessage({
        tenantId: payload.tenantId,
        type: 'rejection',
        subject: tpl.subject,
        body: tpl.html,
        recipient: payload.candidateEmail,
        status: 'failed',
        direction: 'outbound',
      });

      await communicationRepository.createNotification({
        tenantId: payload.tenantId,
        channel: 'email',
        type: 'rejection',
        recipient: payload.candidateEmail,
        title: tpl.subject,
        body: err instanceof Error ? err.message : 'Failed to send email',
        status: 'failed',
      });

      throw err;
    }
  },

  async listMessagesByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Message[]; total: number }> {
    return communicationRepository.listMessagesByTenant(tenantId, pagination.page, pagination.limit);
  },

  async getMessages(tenantId: string, pagination: PaginationInput): Promise<{ items: Message[]; total: number }> {
    return communicationRepository.listMessagesByTenant(tenantId, pagination.page, pagination.limit);
  },

  async getNotifications(tenantId: string, pagination: PaginationInput): Promise<{ items: Notification[]; total: number }> {
    return communicationRepository.listNotificationsByTenant(tenantId, pagination.page, pagination.limit);
  },

  async sendManualMessage(tenantId: string, payload: ManualSendMessageInput, actorId?: string): Promise<Message> {
    try {
      await sendEmail({ to: payload.to, subject: payload.subject, html: payload.html });
      const message = await communicationRepository.createMessage({
        tenantId,
        type: 'manual',
        subject: payload.subject,
        body: payload.html,
        recipient: payload.to,
        status: 'sent',
        direction: 'outbound',
        sentAt: new Date(),
      });
      await auditService.createAuditLog({
        tenantId,
        actorId,
        action: 'send_message',
        entityType: 'message',
        entityId: message.id,
        metadata: { to: payload.to, subject: payload.subject, type: 'manual' },
      });
      return message;
    } catch (err) {
      const message = await communicationRepository.createMessage({
        tenantId,
        type: 'manual',
        subject: payload.subject,
        body: payload.html,
        recipient: payload.to,
        status: 'failed',
        direction: 'outbound',
      });
      await auditService.createAuditLog({
        tenantId,
        actorId,
        action: 'send_message',
        entityType: 'message',
        entityId: message.id,
        metadata: { to: payload.to, subject: payload.subject, type: 'manual', status: 'failed' },
      });
      throw err;
    }
  },
};
