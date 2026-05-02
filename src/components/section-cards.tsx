import Link from "next/link"
import { IconCreditCard, IconEye, IconTrendingDown, IconTrendingUp, IconUsers } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DashboardPaymentsThisMonth = {
  amountLabel: string;
  completedCount: number;
  /** Vs. prior calendar month revenue; omit badge when null. */
  changePercent: number | null;
};

interface SectionCardsProps {
  activeCampaigns: number;
  totalCampaigns: number;
  campaignImpressions: number;
  activeUsers: number;
  liveUsers?: number;
  /** Footer under extension user count when `liveUsers` is not set (e.g. scoped metric for non-admins). */
  extensionUsersCaption?: string;
  /** Optional card to prepend to the grid (e.g. live connections) */
  extraCard?: React.ReactNode;
  /** Admin-only: completed payment revenue this calendar month. */
  paymentsThisMonth?: DashboardPaymentsThisMonth;
}

export function SectionCards({
  activeCampaigns,
  totalCampaigns,
  campaignImpressions,
  activeUsers,
  liveUsers,
  extensionUsersCaption,
  extraCard,
  paymentsThisMonth,
}: SectionCardsProps) {
  const activePercentage = totalCampaigns > 0 ? Math.round((activeCampaigns / totalCampaigns) * 100) : 0;

  return (
    <section
      aria-label="Key metrics"
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-2',
        paymentsThisMonth ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'
      )}
    >
      {extraCard}
      <Card
        className="app-rise-in border-border bg-card/40 py-4 shadow-none"
        style={{ animationDelay: '0ms' }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active campaigns</CardTitle>
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <IconTrendingUp className="size-3" />
            {activePercentage}%
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{activeCampaigns}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            of {totalCampaigns}
          </p>
        </CardContent>
      </Card>
      <Card
        className="app-rise-in border-border bg-card/40 py-4 shadow-none"
        style={{ animationDelay: '60ms' }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Campaign impressions</CardTitle>
          <IconEye className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{campaignImpressions}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            All-time, excl. visits
          </p>
        </CardContent>
      </Card>
      <Link
        href="/users"
        className={cn(
          'block h-full rounded-xl text-inherit no-underline outline-none ring-offset-background',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        aria-label="Open App users — view user list"
      >
        <Card
          className={cn(
            'app-rise-in border-border bg-card/40 py-4 shadow-none',
            'h-full cursor-pointer transition-colors hover:bg-accent/15 dark:hover:bg-accent/10'
          )}
          style={{ animationDelay: '120ms' }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">App users</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{activeUsers}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {liveUsers !== undefined
                ? `${liveUsers} live right now`
                : extensionUsersCaption ?? 'Registered'}
            </p>
          </CardContent>
        </Card>
      </Link>
      {paymentsThisMonth ? (
        <Link
          href="/payments#payments-table-heading"
          className={cn(
            'block h-full rounded-xl text-inherit no-underline outline-none ring-offset-background',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
          aria-label="Open payments"
        >
          <Card
            className={cn(
              'app-rise-in border-border bg-card/40 py-4 shadow-none',
              'h-full cursor-pointer transition-colors hover:bg-accent/15 dark:hover:bg-accent/10'
            )}
            style={{ animationDelay: '180ms' }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payments this month</CardTitle>
              {paymentsThisMonth.changePercent != null ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'tabular-nums',
                    paymentsThisMonth.changePercent >= 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  )}
                >
                  {paymentsThisMonth.changePercent >= 0 ? (
                    <IconTrendingUp className="size-3" aria-hidden />
                  ) : (
                    <IconTrendingDown className="size-3" aria-hidden />
                  )}
                  {paymentsThisMonth.changePercent >= 0 ? '+' : ''}
                  {paymentsThisMonth.changePercent}%
                </Badge>
              ) : (
                <IconCreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{paymentsThisMonth.amountLabel}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {paymentsThisMonth.completedCount.toLocaleString()} completed
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </section>
  )
}
