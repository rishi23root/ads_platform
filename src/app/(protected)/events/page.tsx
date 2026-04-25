import { EventsFilters } from '@/components/events-filters';
import { EventsActiveFilterChips } from '@/components/events-visual-filters';
import { EventsPageLayout } from '@/components/events-page-layout';
import { ExtensionEventsLogTable } from '@/components/extension-events-log-table';
import { DateDisplayToggleButton } from '@/components/date-display-toggle-button';
import { ExportEventsCsvButton } from '@/components/export-events-csv-button';
import { RefreshDataButton } from '@/components/refresh-data-button';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { TablePagination } from '@/components/ui/table-pagination';
import { getSessionWithRole } from '@/lib/dal';
import {
  eventsFilterChips,
  eventsFilterParamsRecord,
  listEventsPageWithCount,
  parseEventsDashboardFilters,
} from '@/lib/events-dashboard';
import { IconChartBar } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Events',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSessionWithRole();
  if (!session) redirect('/login');

  const raw = await searchParams;
  const filters = parseEventsDashboardFilters(raw);
  const pageParam = raw.page;
  const pageStr =
    typeof pageParam === 'string' ? pageParam : Array.isArray(pageParam) ? pageParam[0] : '1';
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const filterRecord = eventsFilterParamsRecord(filters);
  const filterChips = eventsFilterChips(filters);

  // Single query returns both rows and total count via count(*) OVER()
  const { rows: pageRows, totalCount } = await listEventsPageWithCount(
    session.role,
    session.user.id,
    filters,
    { limit: PAGE_SIZE, offset }
  );
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const paginationEl =
    totalCount > 0 ? (
      <TablePagination
        mode="link"
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/events"
        filterParams={filterRecord}
      />
    ) : null;

  return (
    <EventsPageLayout
      filterContent={
        <EventsFilters
          type={filters.type}
          from={filters.from}
          to={filters.to}
          domain={filters.domain}
          country={filters.country}
          endUserId={filters.endUserId}
          email={filters.email}
          campaignId={filters.campaignId}
        />
      }
    >
      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <IconChartBar className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">Event log ({totalCount.toLocaleString()})</span>
            </h2>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {paginationEl}
            <ExportEventsCsvButton filterParams={filterRecord} />
            <DateDisplayToggleButton />
            <RefreshDataButton
              ariaLabel="Refresh events"
              tooltip="Reload events with current filters"
            />
          </div>
        </div>
        <EventsActiveFilterChips chips={filterChips} />
        <DataTableSurface className="min-w-0">
          <ExtensionEventsLogTable
            rows={pageRows}
            emptyMessage="No events match the current filters. Activity from your users will appear here."
          />
        </DataTableSurface>
      </section>
    </EventsPageLayout>
  );
}
