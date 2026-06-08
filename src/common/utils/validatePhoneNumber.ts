import { isValidPhoneNumber } from 'libphonenumber-js';

export function isValidE164PhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isValidPhoneNumber(trimmed);
}
