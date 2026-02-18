import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { visitors } from '@/db/schema';
import { and, desc, sql, ilike, isNotNull } from 'drizzle-orm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IconUsers } from '@tabler/icons-react';
import { VisitorsFilters } from '@/components/visitors-filters';
import { VisitorsPageLayout } from '@/components/visitors-page-layout';
import { RefreshDataButton } from '@/components/refresh-data-button';
import { TablePagination } from '@/components/ui/table-pagination';
import { VisitorIdCell } from '@/components/visitor-id-cell';
import { getCountryName } from '@/lib/countries';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  visitorId?: string;
  joinedFrom?: string;
  joinedTo?: string;
  lastSeenFrom?: string;
  lastSeenTo?: string;
  country?: string;
  page?: string;
}>;

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');

  const params = await searchParams;
  const visitorId = params.visitorId?.trim() || undefined;
  const joinedFrom = params.joinedFrom;
  const joinedTo = params.joinedTo;
  const lastSeenFrom = params.lastSeenFrom;
  const lastSeenTo = params.lastSeenTo;
  const country = params.country?.trim() || undefined;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const whereConditions = [];
  if (visitorId) {
    const escaped = visitorId.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    whereConditions.push(ilike(visitors.visitorId, `%${escaped}%`));
  }
  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const baseQuery = db
    .select({
      visitorId: visitors.visitorId,
      totalRequests: sql<number>`count(*)::int`.as('total_requests'),
      createdAt: sql<Date>`min(${visitors.createdAt})`.as('created_at'),
      lastSeenAt: sql<Date>`max(${visitors.createdAt})`.as('last_seen_at'),
      country: sql<string | null>`(array_agg(${visitors.country} ORDER BY ${visitors.createdAt} DESC NULLS LAST))[1]`.as('country'),
    })
    .from(visitors)
    .groupBy(visitors.visitorId);

  const havingConditions = [];
  if (joinedFrom) {
    havingConditions.push(sql`min(${visitors.createdAt}) >= ${new Date(joinedFrom)}`);
  }
  if (joinedTo) {
    const end = new Date(joinedTo);
    if (!joinedTo.includes('T')) end.setHours(23, 59, 59, 999);
    havingConditions.push(sql`min(${visitors.createdAt}) <= ${end}`);
  }
  if (lastSeenFrom) {
    havingConditions.push(sql`max(${visitors.createdAt}) >= ${new Date(lastSeenFrom)}`);
  }
  if (lastSeenTo) {
    const end = new Date(lastSeenTo);
    if (!lastSeenTo.includes('T')) end.setHours(23, 59, 59, 999);
    havingConditions.push(sql`max(${visitors.createdAt}) <= ${end}`);
  }
  if (country) {
    const countryCode = country.toUpperCase().slice(0, 2);
    havingConditions.push(sql`(array_agg(${visitors.country} ORDER BY ${visitors.createdAt} DESC NULLS LAST))[1] = ${countryCode}`);
  }
  const havingClause = havingConditions.length > 0 ? sql.join(havingConditions, sql` AND `) : undefined;

  let listQuery = baseQuery
    .where(whereClause)
    .orderBy(desc(sql`max(${visitors.createdAt})`))
    .limit(pageSize)
    .offset(offset);
  if (havingClause) listQuery = listQuery.having(havingClause);

  let countQuery = db
    .select({ visitorId: visitors.visitorId })
    .from(visitors)
    .where(whereClause)
    .groupBy(visitors.visitorId);
  if (havingClause) countQuery = countQuery.having(havingClause);

  const [visitorsList, countRows, countryRows] = await Promise.all([
    listQuery,
    countQuery,
    db
      .selectDistinct({ country: visitors.country })
      .from(visitors)
      .where(isNotNull(visitors.country))
      .orderBy(visitors.country),
  ]);

  const totalCount = countRows.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const countryOptions = countryRows
    .map((r) => r.country)
    .filter((c): c is string => c != null)
    .map((code) => ({ code, name: getCountryName(code) }));

  const filterParams: Record<string, string> = {};
  if (visitorId) filterParams.visitorId = visitorId;
  if (joinedFrom) filterParams.joinedFrom = joinedFrom;
  if (joinedTo) filterParams.joinedTo = joinedTo;
  if (lastSeenFrom) filterParams.lastSeenFrom = lastSeenFrom;
  if (lastSeenTo) filterParams.lastSeenTo = lastSeenTo;
  if (country) filterParams.country = country;

  return (
    <VisitorsPageLayout
      filterContent={
        <VisitorsFilters
          visitorId={visitorId}
          joinedFrom={joinedFrom}
          joinedTo={joinedTo}
          lastSeenFrom={lastSeenFrom}
          lastSeenTo={lastSeenTo}
          country={country}
          countryOptions={countryOptions}
        />
      }
    >
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <IconUsers className="h-5 w-5" />
              Visitors ({totalCount.toLocaleString()})
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Filter by date joined, last seen, or country
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {totalCount > 0 && (
              <TablePagination
                mode="link"
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                basePath="/visitors"
                filterParams={filterParams}
              />
            )}
            <RefreshDataButton ariaLabel="Refresh visitors" />
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor ID</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-center">Total Visits</TableHead>
                <TableHead>Date Joined</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitorsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No visitors match your filters. Try adjusting the date range or country.
                  </TableCell>
                </TableRow>
              ) : (
                visitorsList.map((v) => (
                  <TableRow key={v.visitorId}>
                    <TableCell>
                      <VisitorIdCell visitorId={v.visitorId} />
                    </TableCell>
                    <TableCell>
                      {v.country ? (
                        <span className="uppercase">{v.country}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {v.totalRequests.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(v.lastSeenAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </VisitorsPageLayout>
  );
}
