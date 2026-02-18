import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { visitors } from '@/db/schema';
import { and, gte, lte, eq, desc, sql, ilike, isNotNull } from 'drizzle-orm';
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

  const conditions = [];
  if (visitorId) {
    const escaped = visitorId.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    conditions.push(ilike(visitors.visitorId, `%${escaped}%`));
  }
  if (joinedFrom) {
    conditions.push(gte(visitors.createdAt, new Date(joinedFrom)));
  }
  if (joinedTo) {
    const end = new Date(joinedTo);
    if (!joinedTo.includes('T')) end.setHours(23, 59, 59, 999);
    conditions.push(lte(visitors.createdAt, end));
  }
  if (lastSeenFrom) {
    conditions.push(gte(visitors.lastSeenAt, new Date(lastSeenFrom)));
  }
  if (lastSeenTo) {
    const end = new Date(lastSeenTo);
    if (!lastSeenTo.includes('T')) end.setHours(23, 59, 59, 999);
    conditions.push(lte(visitors.lastSeenAt, end));
  }
  if (country) {
    conditions.push(eq(visitors.country, country.toUpperCase().slice(0, 2)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [visitorsList, countResult, countryRows] = await Promise.all([
    db
      .select()
      .from(visitors)
      .where(whereClause)
      .orderBy(desc(visitors.lastSeenAt))
      .limit(pageSize)
      .offset(offset),
    whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(visitors).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(visitors),
    db
      .selectDistinct({ country: visitors.country })
      .from(visitors)
      .where(isNotNull(visitors.country))
      .orderBy(visitors.country),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
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
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Unique Visitors</h1>
        <p className="text-muted-foreground">
          Extension users who have interacted with your campaigns
        </p>
      </div>

      <VisitorsFilters
        visitorId={visitorId}
        joinedFrom={joinedFrom}
        joinedTo={joinedTo}
        lastSeenFrom={lastSeenFrom}
        lastSeenTo={lastSeenTo}
        country={country}
        countryOptions={countryOptions}
      />

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
          {totalCount > 0 && (
            <div className="shrink-0">
              <TablePagination
                mode="link"
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                basePath="/visitors"
                filterParams={filterParams}
              />
            </div>
          )}
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
    </div>
  );
}
