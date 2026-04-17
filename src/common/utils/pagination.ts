export type PaginationInput = {
  page: number;
  limit: number;
  skip: number;
};

const normalizeQueryValue = (value: unknown): string | number | undefined => {
  if (Array.isArray(value)) {
    return normalizeQueryValue(value[0]);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return undefined;
};

export const parsePagination = (pageValue?: unknown, limitValue?: unknown): PaginationInput => {
  const page = Math.max(1, Number(normalizeQueryValue(pageValue) ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(normalizeQueryValue(limitValue) ?? 10) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};
