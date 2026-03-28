'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { IconUsers } from '@tabler/icons-react';

// IMPORTANT: Must use /api/realtime/stream (auth-required, read-only). Do NOT use
// /api/extension/live — that endpoint increments the connection count, so dashboard
// sessions would be incorrectly counted as extension users.
const STREAM_URL = '/api/realtime/stream';
const RECONNECT_DELAY_MS = 3000;
/** `(protected)/page.tsx` — only this route should open the SSE. */
const DASHBOARD_PATHNAME = '/';

export function LiveConnectionsCard() {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const onDashboard = pathname === DASHBOARD_PATHNAME;
  const displayCount = onDashboard ? count : null;
  const displayError = onDashboard && error;

  useEffect(() => {
    if (!onDashboard) {
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(STREAM_URL);

      es.addEventListener('connection_count', (e: MessageEvent<string>) => {
        const n = parseInt(e.data, 10);
        setCount(Number.isNaN(n) ? 0 : n);
        setError(false);
      });

      es.onerror = () => {
        es?.close();
        es = null;
        setError(true);
        reconnectTimeout = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      es?.close();
    };
  }, [onDashboard]);

  return (
    <Card className="border-border bg-card/40 py-4 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Live connections</CardTitle>
        {displayCount != null && displayCount > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 rounded-full bg-red-500 motion-safe:animate-[live-blink_1.5s_ease-in-out_infinite]"
              aria-hidden
            />
            Live
          </span>
        ) : (
          <IconUsers className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </CardHeader>
      <CardContent>
        <div
          className="text-2xl font-bold tabular-nums"
          aria-live="polite"
          aria-busy={displayCount === null && !displayError}
          aria-atomic="true"
        >
          {displayCount === null ? (displayError ? '—' : '…') : displayCount}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Open browser connections from the extension right now
        </p>
      </CardContent>
    </Card>
  );
}
