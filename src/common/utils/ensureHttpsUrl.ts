/** Normalize user-entered URLs: fix https:/ typos and prepend https:// when missing. */
export function ensureHttpsUrl(value: string): string {
  let trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('https:/') && !trimmed.startsWith('https://')) {
    trimmed = trimmed.replace('https:/', 'https://');
  }
  if (trimmed.startsWith('http:/') && !trimmed.startsWith('http://')) {
    trimmed = trimmed.replace('http:/', 'http://');
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  return trimmed;
}
