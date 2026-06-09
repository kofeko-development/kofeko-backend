const GENERIC_CONTACT_NAMES = new Set(['company admin', 'admin user']);

export function isGenericContactName(name: string | undefined | null): boolean {
  if (!name?.trim()) return true;
  return GENERIC_CONTACT_NAMES.has(name.trim().toLowerCase());
}

export function contactNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim().toLowerCase() ?? '';
  if (!local) return 'Admin User';

  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return parts.join(' ') || 'Admin User';
}

export function resolveRegistrationContactName(contactName: string | undefined, adminEmail: string): string {
  const trimmed = contactName?.trim();
  if (trimmed && !isGenericContactName(trimmed)) {
    return trimmed;
  }
  return contactNameFromEmail(adminEmail);
}

export function splitContactName(contactName: string, adminEmail: string): { firstName: string; lastName: string } {
  const resolved = resolveRegistrationContactName(contactName, adminEmail);
  const spaceIdx = resolved.indexOf(' ');
  const firstName = (spaceIdx === -1 ? resolved : resolved.slice(0, spaceIdx)).trim() || 'Admin';
  const lastName = (spaceIdx === -1 ? 'User' : resolved.slice(spaceIdx + 1)).trim() || 'User';
  return { firstName, lastName };
}
