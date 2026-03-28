import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import { isNotNull } from 'drizzle-orm';
import { IconUsers } from '@tabler/icons-react';
import { UsersFilters } from '@/components/users-filters';
import { UsersPageLayout } from '@/components/users-page-layout';
import { UsersTable } from '@/components/users-table';
import { RefreshDataButton } from '@/components/refresh-data-button';
import { ExportCsvButton } from '@/components/export-csv-button';
import { AddEndUserDialog } from '@/components/add-end-user-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { getCountryName } from '@/lib/countries';
import {
  parseEndUsersDashboardFilters,
  runEndUsersListQuery,
  countEndUsersListQuery,
} from '@/lib/end-users-dashboard';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  q?: string;
  endUserId?: string;
  joinedFrom?: string;
  joinedTo?: string;
  lastSeenFrom?: string;
  lastSeenTo?: string;
  country?: string;
  plan?: string;
  status?: string;
  page?: string;
}>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') {
    redirect('/');
  }

  const params = await searchParams;
  const filters = parseEndUsersDashboardFilters(params);
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const [usersList, countryRows, totalCount] = await Promise.all([
    runEndUsersListQuery(filters, {
      limit: pageSize,
      offset,
    }),
    db
      .selectDistinct({ country: endUsers.country })
      .from(endUsers)
      .where(isNotNull(endUsers.country))
      .orderBy(endUsers.country),
    countEndUsersListQuery(filters),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const countryOptions = countryRows
    .map((r) => r.country)
    .filter((c): c is string => c != null)
    .map((code) => ({ code, name: getCountryName(code) }));

  const filterParams: Record<string, string> = {};
  if (filters.q) filterParams.q = filters.q;
  if (filters.joinedFrom) filterParams.joinedFrom = filters.joinedFrom;
  if (filters.joinedTo) filterParams.joinedTo = filters.joinedTo;
  if (filters.lastSeenFrom) filterParams.lastSeenFrom = filters.lastSeenFrom;
  if (filters.lastSeenTo) filterParams.lastSeenTo = filters.lastSeenTo;
  if (filters.country) filterParams.country = filters.country;
  if (filters.plan) filterParams.plan = filters.plan;
  if (filters.status) filterParams.status = filters.status;

  return (
    <UsersPageLayout
      filterContent={
        <UsersFilters
          q={filters.q}
          joinedFrom={filters.joinedFrom}
          joinedTo={filters.joinedTo}
          lastSeenFrom={filters.lastSeenFrom}
          lastSeenTo={filters.lastSeenTo}
          country={filters.country}
          plan={filters.plan}
          status={filters.status}
          countryOptions={countryOptions}
        />
      }
    >
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <IconUsers className="h-5 w-5" />
              Extension users ({totalCount.toLocaleString()})
            </h2>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {totalCount > 0 && (
              <TablePagination
                mode="link"
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                basePath="/users"
                filterParams={filterParams}
              />
            )}
            <ExportCsvButton filterParams={filterParams} />
            <RefreshDataButton ariaLabel="Refresh users" />
            <AddEndUserDialog />
          </div>
        </div>
        <div className="rounded-md border">
          <UsersTable rows={usersList} />
        </div>
      </section>
    </UsersPageLayout>
  );
}
