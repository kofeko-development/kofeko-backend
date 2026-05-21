import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const TERMINAL_STAGES: string[] = ['hired', 'rejected'];

export function assertValidStageTransition(current: string, _next: string): void {
  if (TERMINAL_STAGES.includes(current)) {
    throw new AppError(
      `Pipeline is already ${current} — no further transitions allowed`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
}
