"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { IconChartBar, IconWorld } from "@tabler/icons-react"
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
  ChartTooltipContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type AnalyticsSummary = {
  total: number
  visit: number
  ad: number
  popup: number
  notification: number
  redirect: number
  request: number
  served: number
}

type SeriesRow = {
  date: string
  visit: number
  ad: number
  popup: number
  notification: number
  redirect: number
  request: number
}

type DomainRow = {
  domain: string
  visits: number
  serves: number
}

type AnalyticsPayload = {
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

const timeSeriesConfig = {
  visit: {
    label: "Visits",
    color: "var(--chart-1)",
  },
  served: {
    label: "Served",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function eventsDeepLink(endUserId: string, startIso: string, endIso: string): string {
  const from = startIso.slice(0, 10)
  const to = endIso.slice(0, 10)
  const q = new URLSearchParams({ endUserId, from, to })
  return `/events?${q.toString()}`
}

export type EndUserAnalyticsSectionProps = {
  endUserId: string
  className?: string
}

export function EndUserAnalyticsSection({ endUserId, className }: EndUserAnalyticsSectionProps) {
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d")
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    void load()
  }, [load])

  const chartRows = useMemo(() => {
    if (!data?.series?.length) return []
    return data.series.map((s) => ({
      date: s.date,
      visit: s.visit,
      served: s.ad + s.popup + s.notification + s.redirect,
    }))
  }, [data?.series])

  const chartAllZero =
    chartRows.length > 0 && chartRows.every((d) => d.visit === 0 && d.served === 0)

  const mixRows = useMemo(() => {
    if (!data?.summary) return []
    const s = data.summary
    return [
      { label: "Visit", value: s.visit },
      { label: "Ad", value: s.ad },
      { label: "Popup", value: s.popup },
      { label: "Notification", value: s.notification },
      { label: "Redirect", value: s.redirect },
      { label: "Request", value: s.request },
    ]
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [data?.summary])

  const summary = data?.summary
  const deepLink = data && eventsDeepLink(endUserId, data.start, data.end)

  return (
    <section
      aria-label="Extension activity analytics"
      className={cn("flex flex-col gap-4", className)}
    >
      <Card className="@container/analytics overflow-hidden shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <IconChartBar className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              Activity from extension telemetry
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Visits, inventory served, and sites from this user&apos;s extension events in the
              selected range. For raw rows, open Events with this user pre-filtered.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:items-end shrink-0 w-full sm:w-auto">
            {deepLink ? (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                <Link href={deepLink}>View in Events</Link>
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
        <CardContent className="space-y-6 pt-0">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-[240px] w-full rounded-lg" />
            </div>
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
                  No extension events in this range. The user may not have used the extension yet, or
                  activity may fall outside logging paths.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {(
                      [
                        ["total", "Total events", summary.total],
                        ["visit", "Visits", summary.visit],
                        ["served", "Served", summary.served],
                        ["request", "Requests (no fill)", summary.request],
                      ] as const
                    ).map(([key, label, value]) => (
                      <Card key={key} className="min-w-0 gap-0 py-0 shadow-sm">
                        <CardHeader className="px-4 py-3 space-y-1">
                          <CardDescription className="text-xs leading-snug">{label}</CardDescription>
                          <CardTitle className="text-xl font-semibold tabular-nums leading-none">
                            {value.toLocaleString()}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Activity over time</h3>
                    {chartRows.length === 0 || chartAllZero ? (
                      <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed">
                        No daily activity in this range.
                      </p>
                    ) : (
                      <ChartContainer config={timeSeriesConfig} className="aspect-auto h-[240px] w-full">
                        <AreaChart data={chartRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="fillVisitAn" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-visit)" stopOpacity={0.9} />
                              <stop offset="95%" stopColor="var(--color-visit)" stopOpacity={0.12} />
                            </linearGradient>
                            <linearGradient id="fillServedAn" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-served)" stopOpacity={0.85} />
                              <stop offset="95%" stopColor="var(--color-served)" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={28}
                            tickFormatter={(value) =>
                              new Date(String(value) + "T12:00:00Z").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                labelFormatter={(value) =>
                                  new Date(String(value) + "T12:00:00Z").toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                }
                                indicator="dot"
                              />
                            }
                          />
                          <Area
                            type="natural"
                            dataKey="visit"
                            stackId="a"
                            stroke="var(--color-visit)"
                            fill="url(#fillVisitAn)"
                          />
                          <Area
                            type="natural"
                            dataKey="served"
                            stackId="a"
                            stroke="var(--color-served)"
                            fill="url(#fillServedAn)"
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Stacked: visits (bottom) and served events (ad, popup, notification, redirect) on top.
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-sm font-medium">Mix by event type</h3>
                      {mixRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
                          No type breakdown.
                        </p>
                      ) : (
                        <ChartContainer
                          config={{ count: { label: "Events", color: "var(--chart-3)" } }}
                          className="aspect-auto h-[min(280px,50vh)] w-full"
                        >
                          <BarChart
                            data={mixRows}
                            layout="vertical"
                            margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                          >
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/60" />
                            <XAxis type="number" tickLine={false} axisLine={false} className="text-xs tabular-nums" />
                            <YAxis
                              type="category"
                              dataKey="label"
                              width={100}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 12 }}
                            />
                            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                            <Bar dataKey="value" name="Events" radius={4} fill="var(--chart-3)" />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </div>

                    <div className="space-y-2 min-w-0">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <IconWorld className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        Top domains
                      </h3>
                      {data && !data.topDomains.length ? (
                        <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
                          No domain data in this range.
                        </p>
                      ) : data ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Domain</TableHead>
                              <TableHead className="text-right tabular-nums">Visits</TableHead>
                              <TableHead className="text-right tabular-nums">Served</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.topDomains.map((row) => (
                              <TableRow key={row.domain}>
                                <TableCell
                                  className="font-mono text-xs max-w-[200px] truncate"
                                  title={row.domain}
                                >
                                  {row.domain}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.visits.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.serves.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
