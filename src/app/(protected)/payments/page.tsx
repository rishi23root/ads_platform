import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { IconCreditCard } from '@tabler/icons-react';
import { AllPaymentsTable } from '@/components/all-payments-table';
import { ExportPaymentsCsvButton } from '@/components/export-payments-csv-button';
import { PaymentsFilters } from '@/components/payments-filters';
import { PaymentsPageLayout } from '@/components/payments-page-layout';
import { RefreshDataButton } from '@/components/refresh-data-button';
import { TablePagination } from '@/components/ui/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

/** Plain-language month-over-month revenue vs prior calendar month (USD sums). */
function formatRevenueMomLine(currentCents: number, priorCents: number): string {
  const diff = currentCents - priorCents;
  if (priorCents === 0 && currentCents === 0) {
    return 'Same as prior month ($0).';
  }
  if (priorCents === 0 && currentCents > 0) {
    return `Up from $0 prior month (${formatUsdFromCents(currentCents)} total).`;
  }
  if (diff === 0) {
    return `Flat vs prior month (${formatUsdFromCents(priorCents)}).`;
  }
  const abs = formatUsdFromCents(Math.abs(diff));
  const pct =
    priorCents > 0 ? Math.round((diff / priorCents) * 1000) / 10 : null;
  const pctPart = pct != null ? ` (${diff > 0 ? '+' : ''}${pct}%)` : '';
  if (diff > 0) {
    return `Up ${abs} vs prior month${pctPart}.`;
  }
  return `Down ${abs} vs prior month${pctPart}.`;
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
      <section aria-labelledby="payments-summary-heading" className="space-y-4">
        <h2 id="payments-summary-heading" className="sr-only">
          Revenue summary
        </h2>
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
          <Card className="min-w-0 gap-0 py-0 shadow-sm">
            <CardHeader className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <CardDescription className="min-w-0 leading-snug">Revenue this month</CardDescription>
                <Badge variant="outline" className="text-xs font-normal px-2 py-0 shrink-0">
                  Completed
                </Badge>
              </div>
              <CardTitle className="text-xl font-semibold tabular-nums leading-none">
                {formatUsdFromCents(summary.totalThisMonthCents)}
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-snug space-y-1">
                <span className="block">
                  {summary.completedPaymentsThisMonthCount.toLocaleString()} completed payments ·
                  calendar month (server time).
                </span>
                <span className="block">
                  {formatRevenueMomLine(summary.totalThisMonthCents, summary.totalPriorMonthCents)}
                </span>
              </p>
            </CardHeader>
          </Card>
          <Card className="min-w-0 gap-0 py-0 shadow-sm">
            <CardHeader className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <CardDescription className="min-w-0 leading-snug">Total revenue</CardDescription>
                <Badge variant="outline" className="text-xs font-normal px-2 py-0 shrink-0">
                  Completed
                </Badge>
              </div>
              <CardTitle className="text-xl font-semibold tabular-nums leading-none">
                {formatUsdFromCents(summary.totalEverCents)}
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-snug">
                {summary.completedPaymentsAllTimeCount.toLocaleString()} completed payments · all-time
                sum (USD).
              </p>
            </CardHeader>
          </Card>
          <Card className="min-w-0 gap-0 py-0 shadow-sm">
            <CardHeader className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <CardDescription className="min-w-0 leading-snug">Paid users</CardDescription>
                <Badge variant="outline" className="text-xs font-normal px-2 py-0 shrink-0">
                  Extension
                </Badge>
              </div>
              <CardTitle className="text-xl font-semibold tabular-nums leading-none">
                {summary.paidUsersCount.toLocaleString()}
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-snug">
                On paid plan ·{' '}
                {summary.distinctPayersThisMonthCount.toLocaleString()} with a completed payment this
                month.
              </p>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section aria-labelledby="payments-table-heading" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2
              id="payments-table-heading"
              className="text-base font-semibold flex items-center gap-2"
            >
              <IconCreditCard className="h-5 w-5 shrink-0" aria-hidden />
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
            <RefreshDataButton ariaLabel="Refresh payments" />
          </div>
        </div>
        <div className="rounded-md border min-w-0">
          <AllPaymentsTable rows={rows} />
        </div>
      </section>
    </PaymentsPageLayout>
  );
}
