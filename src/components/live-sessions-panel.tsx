'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconRefresh } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type LiveSessionApiRow = {
  leaseId: string;
  endUserId: string | null;
  lastHeartbeatMs: number;
  email: string | null;
  name: string | null;
  identifier: string | null;
};

type LiveSessionsPayload = {
  totalConnections: number;
  sessions: LiveSessionApiRow[];
};

/** ms values — default 30s, max 5min */
const POLL_OPTIONS_MS = [
  10_000,
  15_000,
  30_000,
  60_000,
  120_000,
  180_000,
  300_000,
] as const;

const DEFAULT_POLL_MS = 30_000;

function pollIntervalLabel(ms: number): string {
  if (ms % 60_000 === 0 && ms >= 60_000) {
    const m = ms / 60_000;
    return m === 1 ? '1 minute' : `${m} minutes`;
  }
  if (ms % 1000 === 0) return `${ms / 1000} seconds`;
  return `${ms / 1000}s`;
}

function shortLease(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}

function formatHeartbeat(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d);
}

type LoadSource = 'mount' | 'poll' | 'manual';

export function LiveSessionsPanel({ children }: { children?: ReactNode }) {
  const [data, setData] = useState<LiveSessionsPayload | null>(null);
  const [initialDone, setInitialDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [pollMs, setPollMs] = useState<number>(DEFAULT_POLL_MS);

  const mountLoadStarted = useRef(false);

  const load = useCallback(async (source: LoadSource) => {
    if (source === 'manual') setManualRefreshing(true);
    try {
      const res = await fetch('/api/realtime/live-sessions', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 401 ? 'Sign in required.' : 'Could not load sessions.');
        setData(null);
        return;
      }
      const json = (await res.json()) as LiveSessionsPayload;
      setData(json);
      setError(null);
    } catch {
      setError('Could not reach the server.');
      setData(null);
    } finally {
      setInitialDone(true);
      if (source === 'manual') setManualRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (mountLoadStarted.current) return;
    mountLoadStarted.current = true;
    void load('mount');
  }, [load]);

  useEffect(() => {
    // Browser timers are numeric IDs; Node typings merge `window.setInterval` to Timeout — use number explicitly.
    let intervalId: number | null = null;

    const clearPoll = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPollIfVisible = () => {
      clearPoll();
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      intervalId = window.setInterval(() => void load('poll'), pollMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearPoll();
      } else {
        void load('poll');
        startPollIfVisible();
      }
    };

    startPollIfVisible();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearPoll();
    };
  }, [load, pollMs]);

  const sessions = data?.sessions ?? [];
  const showInitialSkeleton = !initialDone && !error;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        {children}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-end sm:gap-3 lg:pt-1">
          <div className="space-y-2 sm:text-right">
            <Label htmlFor="live-poll-interval" className="text-muted-foreground">
              Auto-refresh
            </Label>
            <p className="text-xs leading-snug text-muted-foreground sm:max-w-[13rem]">
              While tab is visible.
            </p>
            <Select value={String(pollMs)} onValueChange={(v) => setPollMs(Number(v))}>
              <SelectTrigger
                id="live-poll-interval"
                size="sm"
                className="w-full min-w-[10rem] sm:ml-auto sm:w-[min(100%,220px)]"
              >
                <SelectValue placeholder="Interval" />
              </SelectTrigger>
              <SelectContent>
                {POLL_OPTIONS_MS.map((ms) => (
                  <SelectItem key={ms} value={String(ms)}>
                    {pollIntervalLabel(ms)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load('manual')}
            disabled={manualRefreshing}
            aria-busy={manualRefreshing}
            className="gap-2 sm:self-end"
          >
            <IconRefresh
              className={cn(
                'size-4 shrink-0',
                manualRefreshing && 'motion-safe:animate-spin'
              )}
              aria-hidden
            />
            {manualRefreshing ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DataTableSurface className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Session</TableHead>
              <TableHead className="whitespace-nowrap">App user</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="whitespace-nowrap">Identifier</TableHead>
              <TableHead className="whitespace-nowrap">Last heartbeat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showInitialSkeleton ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No one connected right now.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((row) => (
                <TableRow key={`${row.endUserId ?? 'legacy'}:${row.leaseId}`}>
                  <TableCell className="font-mono text-xs" title={row.leaseId}>
                    {shortLease(row.leaseId)}
                  </TableCell>
                  <TableCell>
                    {row.endUserId ? (
                      <Link
                        href={`/users/${row.endUserId}`}
                        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {row.name?.trim() || row.email?.trim() || row.identifier || row.endUserId}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Legacy session</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                    {row.email ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                    {row.identifier ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatHeartbeat(row.lastHeartbeatMs)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTableSurface>

      {data ? (
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">{data.totalConnections}</span>{' '}
          {data.totalConnections === 1 ? 'connection' : 'connections'}
        </p>
      ) : null}
    </div>
  );
}
