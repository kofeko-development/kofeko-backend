import { ZodError } from 'zod';

export type ZodValidationDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

/**
 * Zod 4's flatten() collapses nested `body.*` errors into fieldErrors.body[].
 * Build per-path field errors from error.issues instead (e.g. body.companyLogo).
 */
export function zodErrorDetails(error: ZodError): ZodValidationDetails {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_form';
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  const formErrors = fieldErrors._form ?? [];
  if (fieldErrors._form) {
    delete fieldErrors._form;
  }

  return { formErrors, fieldErrors };
}
