export function emailFieldError(message: string): { fieldErrors: { email: string } } {
  return { fieldErrors: { email: message } };
}
