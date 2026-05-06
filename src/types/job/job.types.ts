import { HiringPriority, JobStatus } from '@prisma/client';
import { SkillWeight } from '../ai/ai.types';

export type CreateJobInput = {
  tenantId: string;
  title: string;
  description: string;
  location?: string;
  employmentType?: string;
  status?: JobStatus;
  openings?: number;
  department?: string;
  experienceMin?: number;
  experienceMax?: number;
  skillWeights?: SkillWeight[];
  requirements?: string;
  niceToHave?: string;
  screeningQuestions?: string[];
  hiringPriority?: HiringPriority;
};

export type UpdateJobInput = Partial<Omit<CreateJobInput, 'tenantId'>>;
