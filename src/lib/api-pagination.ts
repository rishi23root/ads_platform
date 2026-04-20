/**
 * Shared list pagination for admin API routes (`?page=&pageSize=`).
 */
export function parseListPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}
