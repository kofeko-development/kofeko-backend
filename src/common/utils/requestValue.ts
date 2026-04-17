import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

const normalizeValue = (value: unknown): string | number | undefined => {
  if (Array.isArray(value)) {
    return normalizeValue(value[0]);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return undefined;
};

export const requireStringValue = (value: unknown, fieldName: string): string => {
  const normalizedValue = normalizeValue(value);

  if (typeof normalizedValue === 'string') {
    const trimmedValue = normalizedValue.trim();

    if (trimmedValue) {
      return trimmedValue;
    }
  }

  if (typeof normalizedValue === 'number' && Number.isFinite(normalizedValue)) {
    return String(normalizedValue);
  }

  throw new AppError(`${fieldName} is required`, StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
};

export const optionalStringValue = (value: unknown): string | undefined => {
  const normalizedValue = normalizeValue(value);

  if (typeof normalizedValue === 'string') {
    const trimmedValue = normalizedValue.trim();
    return trimmedValue || undefined;
  }

  if (typeof normalizedValue === 'number' && Number.isFinite(normalizedValue)) {
    return String(normalizedValue);
  }

  return undefined;
};