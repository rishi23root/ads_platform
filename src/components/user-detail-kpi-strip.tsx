"use client"

import { useMemo } from "react"
import type { EndUserDashboardSnapshot } from "@/lib/end-user-dashboard-types"
import {
  END_USER_DISPLAY_LOCALE,
  formatEndUserMoneyCents,
  formatEndUserWhen,
} from "@/lib/end-user-detail-formatting"
import type { EndUserDetailInitialUser } from "@/components/end-user-detail-types"

function KpiStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card/40 px-2.5 py-2 shadow-none sm:rounded-xl sm:px-3 sm:py-3 md:px-4">
      <p className="text-[11px] font-medium leading-snug text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-0.5 min-w-0 break-words text-base font-semibold tabular-nums leading-tight text-balance text-foreground sm:mt-1 sm:text-lg sm:font-bold md:text-xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:mt-1 sm:text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export function UserDetailKpiStrip({
  user,
  dashboard,
}: {
  user: EndUserDetailInitialUser
  dashboard: EndUserDashboardSnapshot
}) {
  const { payments, events } = dashboard

  const paymentsLabel =
    payments.completedCount > 0
      ? `${formatEndUserMoneyCents(payments.completedSumAmount, payments.currency)} · ${payments.completedCount} paid`
      : "No completed payments"

  const overviewCreated = useMemo(
    () =>
      new Date(user.createdAt).toLocaleString(END_USER_DISPLAY_LOCALE, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [user.createdAt],
  )

  return (
    <section aria-label="User overview metrics" className="mt-4 w-full min-w-0 sm:mt-6">
      <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3 min-[520px]:gap-3 xl:grid-cols-5">
        <KpiStat label="Lifetime events" value={events.total.toLocaleString(END_USER_DISPLAY_LOCALE)} />
        <KpiStat
          label="First activity"
          value={formatEndUserWhen(events.firstAt)}
          hint={events.total === 0 ? "No telemetry yet" : undefined}
        />
        <KpiStat label="Last activity" value={formatEndUserWhen(events.lastAt)} />
        <KpiStat label="Payments" value={paymentsLabel} />
        <KpiStat label="Member since" value={overviewCreated} />
      </div>
    </section>
  )
}
