'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IconAd2,
  IconBell,
  IconLoader2,
  IconRoute,
  IconUsers,
  IconWindow,
  IconWorld,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SummaryPayload = {
  total: number;
  uniqueUsers: number;
  ad: number;
  popup: number;
  notification: number;
  redirect: number;
  visit: number;
};

const kpiCards: {
  key: keyof SummaryPayload;
  label: string;
  icon: typeof IconAd2;
}[] = [
  { key: 'total', label: 'Total events', icon: IconWorld },
  { key: 'uniqueUsers', label: 'Unique users', icon: IconUsers },
  { key: 'ad', label: 'Ad', icon: IconAd2 },
  { key: 'popup', label: 'Popup', icon: IconWindow },
  { key: 'notification', label: 'Notification', icon: IconBell },
  { key: 'redirect', label: 'Redirect', icon: IconRoute },
  { key: 'visit', label: 'Visit', icon: IconWorld },
];

type EventsSummaryPanelProps = {
  expanded: boolean;
};

export function EventsSummaryPanel({ expanded }: EventsSummaryPanelProps) {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/events/summary', { credentials: 'include' });
      if (!res.ok) {
        setError('Could not load summary. Try again.');
        setData(null);
        return;
      }
      setData((await res.json()) as SummaryPayload);
    } catch {
      setError('Could not load summary. Try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    void fetchSummary();
  }, [expanded, fetchSummary]);

  return (
    <section aria-label="All-time event summary" className="pt-2">
      {loading && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Loading summary…
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => void fetchSummary()}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpiCards.map(({ key, label, icon: Icon }) => (
            <Card key={key} className="min-w-0 gap-0 py-0 shadow-sm">
              <CardHeader className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <CardDescription className="min-w-0 leading-snug text-xs">
                    {label}
                  </CardDescription>
                  <Icon className="size-4 shrink-0 text-muted-foreground opacity-70" aria-hidden />
                </div>
                <CardTitle className="text-xl font-semibold tabular-nums leading-none">
                  {Number(data[key]).toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
