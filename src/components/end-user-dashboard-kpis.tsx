"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EndUserDashboardSnapshot } from "@/lib/end-user-dashboard-types"
import { IconLayoutDashboard } from "@tabler/icons-react"

/** Fixed locale so SSR and the browser output match (avoids hydration mismatch). */
const DISPLAY_LOCALE = "en-US"

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

function formatWhen(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return "—"
  }
}

function KpiStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="min-w-0 gap-0 py-0 shadow-sm">
      <CardHeader className="px-4 py-3 space-y-1">
        <CardDescription className="text-xs leading-snug">{label}</CardDescription>
        <CardTitle className="text-xl font-semibold tabular-nums leading-none text-balance">
          {value}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground leading-snug">{hint}</p> : null}
      </CardHeader>
    </Card>
  )
}

export type EndUserDashboardKpisProps = {
  dashboard: EndUserDashboardSnapshot
  recordUpdatedAt: string
  className?: string
}

export function EndUserDashboardKpis({
  dashboard,
  recordUpdatedAt,
  className,
}: EndUserDashboardKpisProps) {
  const { payments, sessions, events } = dashboard

  const paymentsLabel =
    payments.completedCount > 0
      ? `${formatMoney(payments.completedSumAmount, payments.currency)} · ${payments.completedCount} paid`
      : "No completed payments"

  return (
    <section aria-label="User dashboard summary" className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <IconLayoutDashboard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold tracking-tight">Dashboard</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
          Lifetime totals (not limited to the analytics date range above).
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiStat label="Lifetime events" value={events.total.toLocaleString(DISPLAY_LOCALE)} />
        <KpiStat
          label="First activity"
          value={formatWhen(events.firstAt)}
          hint={events.total === 0 ? "No telemetry yet" : undefined}
        />
        <KpiStat
          label="Last activity"
          value={formatWhen(events.lastAt)}
          hint={
            events.distinctDomains > 0
              ? `${events.distinctDomains} distinct domain(s)`
              : undefined
          }
        />
        <KpiStat
          label="Sessions"
          value={`${sessions.active} active`}
          hint={`${sessions.total} total records`}
        />
        <KpiStat label="Payments (completed)" value={paymentsLabel} />
        <KpiStat label="Record updated" value={formatWhen(recordUpdatedAt)} />
      </div>

      <Card className="mt-6 overflow-hidden shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campaigns with events</CardTitle>
          <CardDescription className="text-xs">
            {events.distinctCampaignsWithEvents > 0
              ? `Up to 20 campaigns by event volume (${events.distinctCampaignsWithEvents} distinct in telemetry).`
              : "No campaign-linked events for this user yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {dashboard.campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
              No rows to show.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right tabular-nums">Events</TableHead>
                    <TableHead className="w-[100px] text-right font-normal">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.campaigns.map((row) => (
                    <TableRow key={row.campaignId}>
                      <TableCell className="font-medium text-sm">{row.campaignName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.eventCount.toLocaleString(DISPLAY_LOCALE)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/campaigns/${row.campaignId}`}
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
