'use client';

import { useEffect, useState } from 'react';
import { IconCircleFilled } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
        <CardDescription>Active users</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {count === null ? (error ? '—' : '…') : count}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <IconCircleFilled className="size-2.5 animate-pulse" aria-hidden />
            Online
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium text-muted-foreground">
          Extension users currently connected (live)
        </div>
      </CardFooter>
    </Card>
  );
}
