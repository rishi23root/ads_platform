'use client';

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IconLoader2, IconTargetArrow } from '@tabler/icons-react';

interface LinkedCampaign {
  id: string;
  name: string;
  campaignType: string;
  status: string;
}

interface LinkedCampaignsProps {
  type: 'ad' | 'notification' | 'redirect' | 'platform';
  entityId: string;
  /** Hide section heading (use when parent already provides a title, e.g. platform drawer sidebar). */
  embedded?: boolean;
}

/**
 * One short fade/slide after data is ready. Double rAF after mount so the "hidden" frame
 * paints before transitioning. Parent must pass `key={...}` when content changes so this
 * remounts (initial `visible` is false again).
 */
function DrawerContentReveal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  return (
    <div
      className={cn(
        'motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out',
        visible ? 'motion-safe:opacity-100 motion-safe:translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-1',
        'motion-reduce:opacity-100 motion-reduce:translate-y-0'
      )}
    >
      {children}
    </div>
  );
}

function campaignsApiPath(type: LinkedCampaignsProps['type'], entityId: string) {
  if (type === 'ad') return `/api/ads/${entityId}/campaigns`;
  if (type === 'redirect') return `/api/redirects/${entityId}/campaigns`;
  if (type === 'platform') return `/api/platforms/${entityId}/campaigns`;
  return `/api/notifications/${entityId}/campaigns`;
}

/** Coalesce concurrent GETs (Strict Mode, remounts) and brief cache for back-to-back mounts. */
const linkedCampaignsInflight = new Map<string, Promise<LinkedCampaign[]>>();
const linkedCampaignsCache = new Map<string, { data: LinkedCampaign[]; expires: number }>();
/** Brief client cache so reopening the same drawer avoids duplicate GETs */
const LINKED_CAMPAIGNS_CACHE_MS = 20_000;

function peekLinkedCampaignsCache(apiPath: string): LinkedCampaign[] | null {
  const hit = linkedCampaignsCache.get(apiPath);
  if (hit && hit.expires > Date.now()) {
    return hit.data;
  }
  return null;
}

function loadLinkedCampaigns(apiPath: string): Promise<LinkedCampaign[]> {
  const now = Date.now();
  const hit = linkedCampaignsCache.get(apiPath);
  if (hit && hit.expires > now) {
    return Promise.resolve(hit.data);
  }

  let p = linkedCampaignsInflight.get(apiPath);
  if (!p) {
    p = (async () => {
      const res = await fetch(apiPath);
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Failed to fetch campaigns';
        throw new Error(msg);
      }
      return data as LinkedCampaign[];
    })()
      .then((data) => {
        linkedCampaignsCache.set(apiPath, { data, expires: Date.now() + LINKED_CAMPAIGNS_CACHE_MS });
        return data;
      })
      .finally(() => {
        linkedCampaignsInflight.delete(apiPath);
      });
    linkedCampaignsInflight.set(apiPath, p);
  }
  return p;
}

export function LinkedCampaigns({ type, entityId, embedded = false }: LinkedCampaignsProps) {
  const [campaigns, setCampaigns] = useState<LinkedCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiPath = campaignsApiPath(type, entityId);
    let cancelled = false;

    const cached = peekLinkedCampaignsCache(apiPath);
    if (cached) {
      queueMicrotask(() => {
        if (cancelled) return;
        setCampaigns(cached);
        setIsLoading(false);
        setError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setError(null);
      setCampaigns([]);
      setIsLoading(true);
      void loadLinkedCampaigns(apiPath)
        .then((data) => {
          if (!cancelled) setCampaigns(data);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load');
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [type, entityId]);

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground',
          embedded ? 'min-h-24 justify-center px-4 py-8' : 'py-2'
        )}
      >
        <IconLoader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {embedded ? 'Loading campaigns…' : 'Loading linked campaigns...'}
      </div>
    );
  }

  if (error) {
    return (
      <p
        className={cn('text-sm leading-relaxed text-destructive', embedded ? 'px-4 py-3' : 'py-2')}
        role="alert"
      >
        {error}
      </p>
    );
  }

  const revealKey = `${type}:${entityId}:${campaigns.map((c) => c.id).join(',')}`;

  if (campaigns.length === 0) {
    if (embedded) {
      return (
        <DrawerContentReveal key={revealKey}>
          <p className="px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {type === 'platform'
              ? 'No campaigns include this platform in their target list yet.'
              : 'Not linked to any campaigns.'}
          </p>
        </DrawerContentReveal>
      );
    }
    return (
      <DrawerContentReveal key={revealKey}>
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <IconTargetArrow className="h-4 w-4 shrink-0" aria-hidden />
            Linked campaigns
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Not linked to any campaigns</p>
        </div>
      </DrawerContentReveal>
    );
  }

  const listLabel = embedded ? 'Campaigns targeting this platform' : 'Linked campaigns';

  if (embedded) {
    return (
      <DrawerContentReveal key={revealKey}>
        <ul className="divide-y divide-border" aria-label={listLabel}>
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/campaigns/${c.id}`}
                className="group flex min-h-11 flex-col gap-2 px-4 py-3 text-sm outline-none transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="min-w-0 flex-1 font-medium leading-snug text-foreground sm:truncate">
                  {c.name}
                  <span className="sr-only"> — Open campaign</span>
                </span>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border/80 px-2 py-0.5 capitalize tabular-nums">
                    {c.campaignType}
                  </Badge>
                  <Badge
                    variant={c.status === 'active' ? 'default' : 'secondary'}
                    className="px-2 py-0.5 capitalize tabular-nums"
                  >
                    {c.status}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </DrawerContentReveal>
    );
  }

  const list = (
    <ul className="space-y-2" aria-label={listLabel}>
      {campaigns.map((c) => (
        <li key={c.id}>
          <Link
            href={`/campaigns/${c.id}`}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border/80 bg-card/30 px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="min-w-0 flex-1 truncate font-medium leading-snug">{c.name}</span>
            <Badge variant="outline" className="shrink-0 capitalize text-xs">
              {c.campaignType}
            </Badge>
            <Badge
              variant={c.status === 'active' ? 'default' : 'secondary'}
              className="shrink-0 capitalize text-xs"
            >
              {c.status}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <DrawerContentReveal key={revealKey}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <IconTargetArrow className="h-4 w-4 shrink-0" aria-hidden />
          Linked campaigns ({campaigns.length})
        </p>
        {list}
      </div>
    </DrawerContentReveal>
  );
}
