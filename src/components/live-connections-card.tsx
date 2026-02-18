'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// IMPORTANT: Must use /api/realtime/stream (auth-required, read-only). Do NOT use
// /api/extension/live — that endpoint increments the connection count, so dashboard
// sessions would be incorrectly counted as extension users.
const STREAM_URL = '/api/realtime/stream';
const RECONNECT_DELAY_MS = 3000;

export function LiveConnectionsCard() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>Extension users (live)</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {count === null ? (error ? '—' : '…') : count}
        </CardTitle>
        {count != null && count > 0 && (
          <CardAction>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-2 rounded-full bg-red-500 animate-[live-blink_1.5s_ease-in-out_infinite]"
                aria-hidden
              />
              Live
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          Extension users currently connected
        </div>
        <div className="text-muted-foreground">
          Live connection count
        </div>
      </CardFooter>
    </Card>
  );
}
