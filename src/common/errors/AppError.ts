import { getErrorCategory } from './errorCodes';
import { ERROR_CATEGORIES, type ErrorCategory } from './errorCategories';

export { ERROR_CATEGORIES, type ErrorCategory };

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly errorCategory: ErrorCategory;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    details?: unknown,
    category?: ErrorCategory,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.errorCategory = category ?? getErrorCategory(errorCode, statusCode);
  }
}
