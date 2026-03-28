"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

interface ChartDataPoint {
  date: string
  ad: number
  notification: number
}

const chartConfig = {
  ad: {
    label: "Ad & popup",
    color: "var(--chart-1)",
  },
  notification: {
    label: "Notification",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const rangeLabels: Record<string, string> = {
  "90d": "Last 3 months",
  "30d": "Last 30 days",
  "7d": "Last 7 days",
}

function isAllZeroChartData(data: ChartDataPoint[]) {
  return data.every((d) => d.ad === 0 && d.notification === 0)
}

export interface ChartAreaInteractiveProps {
  className?: string
}

export function ChartAreaInteractive({ className }: ChartAreaInteractiveProps) {
  const [mounted, setMounted] = React.useState(false)
  const [timeRange, setTimeRange] = React.useState("7d")
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/events/chart?range=${timeRange}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch chart data")
        return res.json()
      })
      .then((data: ChartDataPoint[]) => {
        if (!cancelled) {
          setChartData(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chart data")
          setChartData([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [timeRange, retryKey])

  const descriptionText = rangeLabels[timeRange] ?? "Last 7 days"

  return (
    <Card
      className={cn(
        "@container/card relative z-0 border-border bg-card/40 py-4 shadow-none overflow-hidden",
        className
      )}
    >
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Extension events</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            <span className="hidden @[540px]/card:block">
              Campaign-linked impressions: ad and popup (one series), plus notification —{" "}
              {descriptionText.toLowerCase()}
            </span>
            <span className="@[540px]/card:hidden">{descriptionText}</span>
          </CardDescription>
        </div>
        <div className="flex items-center justify-start sm:justify-end">
          {mounted ? (
            <>
              <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={(v) => v && setTimeRange(v)}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
              >
                <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
                <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
                <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
              </ToggleGroup>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger
                  className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                  size="sm"
                  aria-label="Select time range"
                >
                  <SelectValue placeholder="Last 7 days" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="90d" className="rounded-lg">
                    Last 3 months
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    Last 30 days
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    Last 7 days
                  </SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {rangeLabels[timeRange] ?? "Last 7 days"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-2 sm:px-6">
        {loading ? (
          <Skeleton className="h-[264px] w-full rounded-lg" />
        ) : error ? (
          <div
            className="flex h-[264px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center"
            role="alert"
          >
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              Retry
            </Button>
          </div>
        ) : chartData.length === 0 ? (
          <div
            className="flex h-[264px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            role="status"
          >
            No event data for this period
          </div>
        ) : isAllZeroChartData(chartData) ? (
          <div
            className="flex h-[264px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            role="status"
          >
            No event data for this period
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[264px] w-full"
          >
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillAd" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-ad)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-ad)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillNotification" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-notification)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-notification)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="notification"
                type="natural"
                fill="url(#fillNotification)"
                stroke="var(--color-notification)"
                stackId="a"
              />
              <Area
                dataKey="ad"
                type="natural"
                fill="url(#fillAd)"
                stroke="var(--color-ad)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
