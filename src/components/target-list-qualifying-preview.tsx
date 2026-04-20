'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconLoader2, IconUsers } from '@tabler/icons-react';
import type { TargetListFilterJson } from '@/lib/target-list-filter';
import { isTargetListFilterEmpty } from '@/lib/target-list-filter';
import type { TargetListMemberRow } from '@/lib/target-list-members-query';
import { cn } from '@/lib/utils';

const PREVIEW_PAGE_SIZE = 40;

function sourceLabel(kind: TargetListMemberRow['memberSource']): string {
  if (kind === 'both') return 'Both';
  if (kind === 'explicit') return 'Explicit';
  if (kind === 'filter') return 'Filter';
  return 'Excluded';
}

type PreviewResponse = {
  rows: TargetListMemberRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

/** Static shell: identical on server and first client paint — avoids hydration mismatches from preview UI updates. */
function QualifyingPreviewSkeleton() {
  return (
    <aside
      className="flex flex-col gap-4 lg:sticky lg:top-6"
      aria-label="List preview and summary"
      aria-busy="true"
    >
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card/40 py-6 shadow-sm">
        <div className="space-y-2 px-6">
          <div className="h-4 w-32 rounded bg-muted/50 motion-reduce:animate-none" />
          <div className="h-3 w-full max-w-[280px] rounded bg-muted/40 motion-reduce:animate-none" />
        </div>
        <div className="space-y-2 px-6 pt-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-md bg-muted/50 motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card/40 py-6 shadow-sm">
        <div className="space-y-3 px-6 pt-0">
          <div className="h-3 w-20 rounded bg-muted/50 motion-reduce:animate-none" />
          <div className="h-16 w-full rounded-md bg-muted/40 motion-reduce:animate-none" />
        </div>
      </div>
    </aside>
  );
}

function TargetListQualifyingPreviewClient({
  filterJson,
  memberIds,
  excludedIds,
  pause = false,
  detailHref,
  filterSummaryLine,
}: {
  filterJson: TargetListFilterJson;
  memberIds: string[];
  excludedIds: string[];
  pause?: boolean;
  detailHref?: string | null;
  filterSummaryLine: string;
}) {
  const hasDef = !isTargetListFilterEmpty(filterJson) || memberIds.length > 0;
  const [loading, setLoading] = useState(() => hasDef && !pause);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewResponse | null>(null);

  const definitionKey = useMemo(
    () =>
      JSON.stringify({
        f: filterJson,
        m: [...memberIds].sort(),
        e: [...excludedIds].sort(),
      }),
    [filterJson, memberIds, excludedIds]
  );

  const fetchPreview = useCallback(
    async (signal: AbortSignal) => {
      const effectiveHasDef = !isTargetListFilterEmpty(filterJson) || memberIds.length > 0;
      if (!effectiveHasDef) {
        setData({ rows: [], totalCount: 0, page: 1, pageSize: PREVIEW_PAGE_SIZE });
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/target-lists/preview-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterJson,
            memberIds,
            excludedIds,
            page: 1,
            pageSize: PREVIEW_PAGE_SIZE,
          }),
          signal,
        });
        const json = (await res.json().catch(() => ({}))) as PreviewResponse & { error?: string };
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Preview failed');
        setData({
          rows: json.rows ?? [],
          totalCount: json.totalCount ?? 0,
          page: json.page ?? 1,
          pageSize: json.pageSize ?? PREVIEW_PAGE_SIZE,
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Preview failed');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [filterJson, memberIds, excludedIds]
  );

  useEffect(() => {
    if (pause) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetchPreview(ac.signal);
    }, 400);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [definitionKey, fetchPreview, pause]);

  useEffect(() => {
    if (pause) setLoading(false);
  }, [pause]);

  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <aside
      className="flex flex-col gap-4 lg:sticky lg:top-6"
      aria-label="List preview and summary"
    >
      <Card className="border bg-card/40 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Qualifying users</CardTitle>
              <CardDescription className="mt-1.5 text-xs leading-relaxed">
                Live preview of who matches this list (filter <span className="text-foreground/80">or</span>{' '}
                explicit members). Updates shortly after you change fields.
              </CardDescription>
            </div>
            {loading ? (
              <IconLoader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <IconUsers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </div>
          {hasDef && !loading && data != null && totalCount > 0 ? (
            <p className="pt-2 text-xs text-muted-foreground tabular-nums">
              Showing{' '}
              <span className="font-medium text-foreground">
                {Math.min(rows.length, totalCount).toLocaleString('en-US')}
              </span>{' '}
              of {totalCount.toLocaleString('en-US')}
              {totalCount > rows.length ? (
                <>
                  {' '}
                  {detailHref ? (
                    <Link
                      href={detailHref}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      View all
                    </Link>
                  ) : (
                    <span className="text-muted-foreground"> — save the list to open the full table.</span>
                  )}
                </>
              ) : null}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0">
          {!hasDef ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">
              Add at least one filter rule or explicit member to see who qualifies.
            </p>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : loading && rows.length === 0 ? (
            <div className="space-y-2 py-2" aria-busy>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-md bg-muted/50 motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : totalCount === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">
              No users match yet. Try widening the filter or adding members.
            </p>
          ) : (
            <ul className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto pr-1">
              {rows.map((row) => {
                const label = row.name?.trim() || row.email?.trim() || row.identifier?.trim() || row.id;
                const sub = row.email?.trim() || row.identifier?.trim() || null;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/users/${row.id}`}
                      className={cn(
                        'block rounded-lg border border-border/60 bg-background/50 px-3 py-2.5',
                        'motion-safe:transition-colors hover:bg-muted/60',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-snug">{label}</p>
                          {sub && sub !== label ? (
                            <p className="truncate text-xs text-muted-foreground">{sub}</p>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] font-normal capitalize">
                          {row.plan}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {row.country ? (
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">
                            {row.country}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {sourceLabel(row.memberSource)}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border bg-card/40 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filter
            </p>
            <p className="leading-relaxed break-words text-foreground/90">
              {filterSummaryLine === '—' ? (
                <span className="text-muted-foreground">None — explicit members only</span>
              ) : (
                filterSummaryLine
              )}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Explicit members
            </p>
            <p className="tabular-nums">{memberIds.length}</p>
          </div>
          {excludedIds.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Excluded (saved)
              </p>
              <p className="tabular-nums">{excludedIds.length}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}

export function TargetListQualifyingPreview(props: {
  filterJson: TargetListFilterJson;
  memberIds: string[];
  excludedIds: string[];
  pause?: boolean;
  detailHref?: string | null;
  filterSummaryLine: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return <QualifyingPreviewSkeleton />;
  }
  return <TargetListQualifyingPreviewClient {...props} />;
}
