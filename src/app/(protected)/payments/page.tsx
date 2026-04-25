import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { IconCreditCard } from '@tabler/icons-react';
import { AllPaymentsTable } from '@/components/all-payments-table';
import { DateDisplayToggleButton } from '@/components/date-display-toggle-button';
import { ExportPaymentsCsvButton } from '@/components/export-payments-csv-button';
import { PaymentsFilters } from '@/components/payments-filters';
import { PaymentsPageLayout } from '@/components/payments-page-layout';
import { RefreshDataButton } from '@/components/refresh-data-button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  countPaymentsListQuery,
  getPaymentsSummary,
  parsePaymentsDashboardFilters,
  runPaymentsListQuery,
} from '@/lib/payments-dashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payments',
};

export const dynamic = 'force-dynamic';

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Month-over-month %; null when prior baseline is zero (no meaningful ratio). */
function percentChangeVsPriorMonth(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
}>;

export default async function PaymentsPage({
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
  const filters = parsePaymentsDashboardFilters(params);
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const [rows, totalCount, summary] = await Promise.all([
    runPaymentsListQuery(filters, { limit: pageSize, offset }),
    countPaymentsListQuery(filters),
    getPaymentsSummary(),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const filterParams: Record<string, string> = {};
  if (filters.q) filterParams.q = filters.q;
  if (filters.status) filterParams.status = filters.status;

  return (
    <PaymentsPageLayout
      filterContent={<PaymentsFilters q={filters.q} status={filters.status} />}
    >
      <section aria-labelledby="payments-summary-heading" className="space-y-3">
        <h2 id="payments-summary-heading" className="sr-only">
          Revenue summary
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="This month"
            value={formatUsdFromCents(summary.totalThisMonthCents)}
            change={percentChangeVsPriorMonth(
              summary.totalThisMonthCents,
              summary.totalPriorMonthCents
            )}
            changeHint="Completed revenue vs. prior calendar month"
          />
          <KpiCard
            label="All-time"
            value={formatUsdFromCents(summary.totalEverCents)}
            change={percentChangeVsPriorMonth(
              summary.completedPaymentsThisMonthCount,
              summary.completedPaymentsPriorMonthCount
            )}
            changeHint="Completed payment count vs. prior month"
          />
          <KpiCard
            label="Paid users"
            value={summary.paidUsersCount}
            change={percentChangeVsPriorMonth(
              summary.distinctPayersThisMonthCount,
              summary.distinctPayersPriorMonthCount
            )}
            changeHint="Distinct payers this month vs. prior month"
          />
        </div>
      </section>

      <section aria-labelledby="payments-table-heading" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex items-center min-h-8">
            <h2
              id="payments-table-heading"
              className="text-base font-semibold flex items-center gap-2 leading-none"
            >
              <IconCreditCard className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">Payments ({totalCount.toLocaleString()})</span>
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
                basePath="/payments"
                filterParams={filterParams}
              />
            )}
            <ExportPaymentsCsvButton filterParams={filterParams} />
            <DateDisplayToggleButton />
            <RefreshDataButton
              ariaLabel="Refresh payments"
              tooltip="Reload payments with current filters"
            />
          </div>
        </div>
        <DataTableSurface className="min-w-0">
          <AllPaymentsTable rows={rows} />
        </DataTableSurface>
      </section>
    </PaymentsPageLayout>
  );
}
