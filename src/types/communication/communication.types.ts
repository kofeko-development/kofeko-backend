import { NotificationChannel } from '@prisma/client';

export type CreateNotificationInput = {
  tenantId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  recipient: string;
  status?: string;
};

export type CreateMessageInput = {
  tenantId: string;
  subject: string;
  body: string;
  recipient: string;
  direction?: string;
};

export type PipelineStageNotificationInput = {
  tenantId: string;
  recipient: string;
  candidateName: string;
  jobTitle: string;
  stage: string;
};
