"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { IconArrowRight, IconChartBar } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { ExtensionEventsChartTooltip } from "@/components/extension-events-chart-tooltip"
import {
  extensionEventChartAllZeros,
  extensionEventsChartConfig,
  formatExtensionChartYAxisTick,
  niceExtensionChartYAxisTicks,
  type ExtensionEventChartRow,
} from "@/lib/extension-events-chart"
import { cn } from "@/lib/utils"

type AnalyticsSummary = {
  total: number
  visit: number
  ad: number
  popup: number
  notification: number
  redirect: number
  served: number
}

type SeriesRow = {
  date: string
  visit: number
  ad: number
  popup: number
  notification: number
  redirect: number
}

type DomainRow = {
  domain: string
  visits: number
  serves: number
}

export type AnalyticsPayload = {
  summary: AnalyticsSummary
  series: SeriesRow[]
  topDomains: DomainRow[]
  range: "7d" | "30d" | "90d"
  start: string
  end: string
  rangeDays: number
}

const rangeLabels: Record<string, string> = {
  "90d": "Last 90 days",
  "30d": "Last 30 days",
  "7d": "Last 7 days",
}

function eventsDeepLink(endUserUuid: string, startIso: string, endIso: string): string {
  const from = startIso.slice(0, 10)
  const to = endIso.slice(0, 10)
  const q = new URLSearchParams({ endUserIdExact: endUserUuid, from, to })
  return `/events?${q.toString()}`
}

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const { ref, visible } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className,
      )}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

export type EndUserAnalyticsSectionProps = {
  endUserId: string
  className?: string
  /** When true, render without Card chrome so a parent can provide one shell (e.g. bento with profile). */
  embedded?: boolean
  /** Pre-loaded 7d analytics data from SSR — skips the initial client-side fetch. */
  initialData?: AnalyticsPayload | null
  /** Called whenever the loaded data changes (on mount and after range switches). */
  onDataLoaded?: (data: AnalyticsPayload | null) => void
}

export function EndUserAnalyticsSection({
  endUserId,
  className,
  embedded = false,
  initialData,
  onDataLoaded,
}: EndUserAnalyticsSectionProps) {
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d")
  const [data, setData] = useState<AnalyticsPayload | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const skipInitialFetch = useRef(!!initialData)

  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/end-users/${encodeURIComponent(endUserId)}/analytics?range=${range}`,
        { credentials: "include" }
      )
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Could not load analytics")
      }
      setData((await res.json()) as AnalyticsPayload)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [endUserId, range])

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    void load()
  }, [load])

  // Notify parent whenever data changes
  useEffect(() => {
    onDataLoaded?.(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const chartRows: ExtensionEventChartRow[] = useMemo(() => {
    if (!data?.series?.length) return []
    return data.series.map((s) => ({
      date: s.date,
      visit: s.visit,
      ad: s.ad,
      popup: s.popup,
      notification: s.notification,
      redirect: s.redirect,
    }))
  }, [data?.series])

  const chartAllZero = chartRows.length > 0 && extensionEventChartAllZeros(chartRows)

  const singleSeriesMax = useMemo(() => {
    if (!chartRows.length) return 0
    let max = 0
    for (const row of chartRows) {
      for (const v of [row.visit, row.popup, row.notification, row.ad, row.redirect]) {
        if (v > max) max = v
      }
    }
    return max
  }, [chartRows])

  const yAxisTicks = useMemo(() => niceExtensionChartYAxisTicks(singleSeriesMax), [singleSeriesMax])
  const yAxisTop = yAxisTicks[yAxisTicks.length - 1] ?? 100

  const summary = data?.summary
  const deepLink = data && eventsDeepLink(endUserId, data.start, data.end)

  const header = (
    <CardHeader
      className={cn(
        "flex flex-col gap-3 space-y-0 px-4 pb-0 sm:flex-row sm:items-start sm:justify-between",
        embedded ? "shrink-0 pt-4" : "pt-0",
      )}
    >
          <div className="space-y-1.5 min-w-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconChartBar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              User activity
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed max-w-lg">
              Daily activity by type for this user. Hover the chart for daily totals.
            </CardDescription>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
            {deepLink ? (
              <Button
                variant="outline"
                size="default"
                className="h-auto min-h-11 w-full justify-center gap-2 border-border/80 bg-background/60 px-4 py-2.5 text-sm font-medium shadow-none hover:bg-muted/50 sm:min-h-9 sm:w-auto sm:py-0"
                asChild
              >
                <Link
                  href={deepLink}
                  title="Opens Events with this user and the chart date range pre-filled as filters"
                  aria-label="Open Events log filtered to this user and the current chart date range"
                >
                  View in Events
                  <IconArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </Button>
            ) : null}
            {mounted ? (
              <>
                <ToggleGroup
                  type="single"
                  value={range}
                  onValueChange={(v) => {
                    if (v === "7d" || v === "30d" || v === "90d") setRange(v)
                  }}
                  variant="outline"
                  className="hidden *:data-[slot=toggle-group-item]:!px-3 @[640px]/analytics:flex"
                >
                  <ToggleGroupItem value="7d">7d</ToggleGroupItem>
                  <ToggleGroupItem value="30d">30d</ToggleGroupItem>
                  <ToggleGroupItem value="90d">90d</ToggleGroupItem>
                </ToggleGroup>
                <Select
                  value={range}
                  onValueChange={(v) => {
                    if (v === "7d" || v === "30d" || v === "90d") setRange(v)
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="@[640px]/analytics:hidden w-full"
                    aria-label="Date range"
                  >
                    <SelectValue placeholder={rangeLabels[range]} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">{rangeLabels["7d"]}</SelectItem>
                    <SelectItem value="30d">{rangeLabels["30d"]}</SelectItem>
                    <SelectItem value="90d">{rangeLabels["90d"]}</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{rangeLabels[range]}</span>
            )}
          </div>
    </CardHeader>
  )

  const body = (
    <CardContent
      className={cn(
        "px-4 pt-2",
        embedded
          ? "flex min-h-0 flex-1 flex-col pb-4"
          : "space-y-4 pt-0 pb-0",
      )}
    >
          {loading && (
            <Skeleton
              className={cn(
                "w-full rounded-lg",
                embedded
                  ? "h-[min(14rem,38vh)] min-h-[180px] max-lg:flex-none sm:min-h-[200px] lg:min-h-0 lg:flex-1"
                  : "h-[min(22rem,45vh)] min-h-[240px]",
              )}
            />
          )}

          {error && !loading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex flex-col gap-2">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && summary && (
            <>
              {summary.total === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  No activity in this range. This user may not have used the app yet, or the
                  events aren&apos;t tracked.
                </div>
              ) : (
                <>
                  <AnimatedSection className={embedded ? "flex min-h-0 flex-1 flex-col" : "space-y-3"}>
                    {!embedded && (
                      <h3 className="text-sm font-medium text-muted-foreground">Activity over time</h3>
                    )}
                    {chartRows.length === 0 || chartAllZero ? (
                      <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed">
                        No daily activity in this range.
                      </p>
                    ) : (
                      <ChartContainer
                        config={extensionEventsChartConfig as ChartConfig}
                        className={cn(
                          "aspect-auto w-full min-w-0 justify-start [&_.recharts-responsive-container]:!w-full [&_.recharts-wrapper]:!max-w-none",
                          embedded
                            ? "h-[min(14rem,38vh)] min-h-[180px] max-lg:shrink-0 sm:min-h-[200px] lg:min-h-0 lg:flex-1"
                            : "h-[min(22rem,45vh)] min-h-[240px]",
                        )}
                      >
                          <AreaChart
                            accessibilityLayer
                            data={chartRows}
                            margin={{ top: 2, right: 10, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="euFillVisit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-visit)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-visit)" stopOpacity={0.08} />
                              </linearGradient>
                              <linearGradient id="euFillPopup" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-popup)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--color-popup)" stopOpacity={0.08} />
                              </linearGradient>
                              <linearGradient id="euFillNotification" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-notification)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--color-notification)" stopOpacity={0.08} />
                              </linearGradient>
                              <linearGradient id="euFillAd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-ad)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--color-ad)" stopOpacity={0.08} />
                              </linearGradient>
                              <linearGradient id="euFillRedirect" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-redirect)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--color-redirect)" stopOpacity={0.08} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={10}
                              minTickGap={28}
                              tickFormatter={(value) => {
                                const date = new Date(value)
                                return date.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              }}
                            />
                            <YAxis
                              width={44}
                              allowDecimals={false}
                              interval={0}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tickFormatter={formatExtensionChartYAxisTick}
                              domain={[0, yAxisTop]}
                              ticks={yAxisTicks}
                            />
                            <ChartTooltip
                              cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }}
                              content={<ExtensionEventsChartTooltip />}
                            />
                            <Area
                              dataKey="visit"
                              type="monotone"
                              strokeWidth={1.5}
                              fill="url(#euFillVisit)"
                              fillOpacity={0.35}
                              stroke="var(--color-visit)"
                            />
                            <Area
                              dataKey="popup"
                              type="monotone"
                              strokeWidth={1.5}
                              fill="url(#euFillPopup)"
                              fillOpacity={0.35}
                              stroke="var(--color-popup)"
                            />
                            <Area
                              dataKey="notification"
                              type="monotone"
                              strokeWidth={1.5}
                              fill="url(#euFillNotification)"
                              fillOpacity={0.35}
                              stroke="var(--color-notification)"
                            />
                            <Area
                              dataKey="ad"
                              type="monotone"
                              strokeWidth={1.5}
                              fill="url(#euFillAd)"
                              fillOpacity={0.35}
                              stroke="var(--color-ad)"
                            />
                            <Area
                              dataKey="redirect"
                              type="monotone"
                              strokeWidth={1.5}
                              fill="url(#euFillRedirect)"
                              fillOpacity={0.35}
                              stroke="var(--color-redirect)"
                            />
                          </AreaChart>
                      </ChartContainer>
                    )}
                  </AnimatedSection>
                </>
              )}
            </>
          )}
    </CardContent>
  )

  if (embedded) {
    return (
      <div
        aria-label="User activity analytics"
        className={cn(
          "@container/analytics flex h-full min-h-0 flex-col gap-3 overflow-hidden",
          className,
        )}
      >
        {header}
        {body}
      </div>
    )
  }

  return (
    <Card
      aria-label="User activity analytics"
      className={cn(
        "@container/analytics gap-3 overflow-hidden border-border bg-card/40 py-4 shadow-none",
        className,
      )}
    >
      {header}
      {body}
    </Card>
  )
}
