"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CopyableIdCell } from "@/components/copyable-id-cell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/ui/table-pagination"
import { Badge } from "@/components/ui/badge"
import { getCountryName } from "@/lib/countries"
import { IconList } from "@tabler/icons-react"

const PAGE_SIZE = 25

type EventRow = {
  id: string
  userIdentifier: string
  endUserUuid: string | null
  email: string | null
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

const typeColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ad: "default",
  notification: "secondary",
  popup: "outline",
  redirect: "outline",
  visit: "secondary",
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ApiResponse | null>(null)

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
  }, [load])

  const totalPages =
    payload && payload.total > 0 ? Math.ceil(payload.total / payload.pageSize) : 0
  const rows = payload?.data ?? []

  return (
    <section aria-label="Extension events for this user" className={className}>
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <IconList className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              Event timeline
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Recent extension telemetry for this user, newest first. Open the full Events log for
              filters and export.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0" asChild>
            <Link href={eventsDeepLink(endUserId)}>View in Events</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-40 w-full rounded-md" />
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

          {!loading && !error && payload && payload.total === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No events recorded for this user yet.
            </div>
          )}

          {!loading && !error && payload && payload.total > 0 && (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs font-normal whitespace-nowrap">
                        Type
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-normal whitespace-nowrap">
                        Domain
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-normal whitespace-nowrap">
                        Campaign
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-normal whitespace-nowrap">
                        Country
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-normal whitespace-nowrap">
                        Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="py-2">
                          <Badge variant={typeColors[log.type] ?? "secondary"}>{log.type}</Badge>
                        </TableCell>
                        <TableCell className="py-2 max-w-[200px]">
                          <span className="truncate block font-mono text-xs" title={log.domain ?? ""}>
                            {log.domain ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 overflow-hidden">
                          {log.campaignId ? (
                            <CopyableIdCell
                              value={log.campaignId}
                              href={`/campaigns/${log.campaignId}`}
                              truncateLength={8}
                              copyLabel="Campaign ID copied to clipboard"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {log.country ? (
                            <span title={getCountryName(log.country)} className="uppercase text-sm">
                              {log.country}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap min-w-0">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 ? (
                <TablePagination
                  mode="button"
                  page={page}
                  totalPages={totalPages}
                  totalCount={payload.total}
                  pageSize={payload.pageSize}
                  onPageChange={setPage}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
