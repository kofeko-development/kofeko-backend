import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const PIPELINE_STAGES = [
  'applied',
  'screening',
  'technical_interview',
  'hr_interview',
  'offer',
  'hired',
  'rejected',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const TERMINAL_STAGES: PipelineStage[] = ['hired', 'rejected'];

export const VALID_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  applied: ['screening', 'rejected'],
  screening: ['technical_interview', 'hr_interview', 'rejected'],
  technical_interview: ['hr_interview', 'offer', 'rejected'],
  hr_interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};

export function assertValidStageTransition(current: PipelineStage, next: PipelineStage): void {
  if (TERMINAL_STAGES.includes(current)) {
    throw new AppError(
      `Pipeline is already ${current} — no further transitions allowed`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new AppError(
      `Invalid transition: ${current} → ${next}. Allowed: ${VALID_TRANSITIONS[current].join(', ')}`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
}

