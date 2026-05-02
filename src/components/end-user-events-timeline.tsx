"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DateDisplayToggleButton } from "@/components/date-display-toggle-button"
import { ExtensionEventsLogTable } from "@/components/extension-events-log-table"
import { ExportEventsCsvButton } from "@/components/export-events-csv-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTableSurface } from "@/components/ui/data-table-surface"
import { TablePagination } from "@/components/ui/table-pagination"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { IconChartBar, IconExternalLink, IconRefresh } from "@tabler/icons-react"

const PAGE_SIZE = 25

type EventRow = {
  id: string
  userIdentifier: string
  endUserUuid: string | null
  email: string | null
  plan: "trial" | "paid" | null
  campaignId: string | null
  domain: string | null
  type: string
  country: string | null
  userAgent: string | null
  createdAt: string
}

type ApiResponse = {
  data: EventRow[]
  total: number
  page: number
  pageSize: number
}

function eventsDeepLink(endUserUuid: string): string {
  const q = new URLSearchParams({ endUserIdExact: endUserUuid })
  return `/events?${q.toString()}`
}

export type EndUserEventsTimelineProps = {
  endUserId: string
  className?: string
}

export function EndUserEventsTimeline({ endUserId, className }: EndUserEventsTimelineProps) {
  const [page, setPage] = useState(1)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ApiResponse | null>(null)

  const csvFilterParams = useMemo(() => ({ endUserIdExact: endUserId }), [endUserId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = `/api/end-users/${encodeURIComponent(endUserId)}/events?page=${page}&pageSize=${PAGE_SIZE}`
      const res = await fetch(u, { credentials: "include" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Could not load events")
      }
      setPayload((await res.json()) as ApiResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load events")
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [endUserId, page])

  useEffect(() => {
    void load()
  }, [load, refreshNonce])

  const totalPages =
    payload && payload.total > 0 ? Math.ceil(payload.total / payload.pageSize) : 0
  const rows = payload?.data ?? []
  const totalCount = payload?.total ?? 0

  const paginationEl =
    !loading && totalCount > 0 ? (
      <TablePagination
        mode="button"
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={payload?.pageSize ?? PAGE_SIZE}
        onPageChange={setPage}
      />
    ) : null

  return (
    <section aria-label="Activity for this app user" className={className}>
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2 tracking-tight">
              <IconChartBar className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">
                Event log ({loading ? "…" : totalCount.toLocaleString()})
              </span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Newest first.</p>
          </div>
          <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
            {paginationEl}
            <ExportEventsCsvButton filterParams={csvFilterParams} />
            <DateDisplayToggleButton />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setRefreshNonce((n) => n + 1)}
              disabled={loading}
              aria-label="Refresh events"
              className="h-9 w-9 min-h-9 min-w-9"
            >
              <IconRefresh className="h-4 w-4" aria-hidden />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-9 min-h-9 min-w-9"
                  asChild
                >
                  <Link
                    href={eventsDeepLink(endUserId)}
                    aria-label="View in Events"
                  >
                    <IconExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Opens Events with this user pre-selected
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {loading && (
          <DataTableSurface variant="embedded" className="min-w-0">
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-40 w-full rounded-md" />
            </div>
          </DataTableSurface>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex flex-col gap-2">
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && payload && totalCount === 0 && (
          <DataTableSurface variant="embedded" className="min-w-0">
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No events recorded for this user yet.
            </div>
          </DataTableSurface>
        )}

        {!loading && !error && payload && totalCount > 0 && (
          <DataTableSurface variant="embedded" className="min-w-0">
            <ExtensionEventsLogTable rows={rows} headerRowClassName="hover:bg-transparent" />
          </DataTableSurface>
        )}
      </div>
    </section>
  )
}
