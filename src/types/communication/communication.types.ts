import { NotificationChannel } from '@prisma/client';

export type CreateNotificationInput = {
  tenantId: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  body: string;
  recipient: string;
  status?: string;
};

export type CreateMessageInput = {
  tenantId: string;
  type: string;
  subject: string;
  body: string;
  recipient: string;
  status?: string;
  direction?: string;
  sentAt?: Date;
};

export type PipelineStageNotificationInput = {
  tenantId: string;
  recipient: string;
  candidateName: string;
  jobTitle: string;
  stage: string;
};

export type ManualSendMessageInput = {
  to: string;
  subject: string;
  html: string;
};
