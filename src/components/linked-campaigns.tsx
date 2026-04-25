'use client';

import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { campaignStatusBadgeVariant } from '@/lib/campaign-display';
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
  /**
   * `popover` — compact list, no drawer animation (for delete guard popovers and small surfaces).
   */
  variant?: 'default' | 'popover';
  /** When true, campaign links go to `/campaigns/[id]/edit` instead of the detail page. */
  editLinks?: boolean;
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
        'motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out',
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

function ListStateWrapper({ revealKey, children }: { revealKey: string; children: ReactNode }) {
  return <DrawerContentReveal key={revealKey}>{children}</DrawerContentReveal>;
}

export function LinkedCampaigns({
  type,
  entityId,
  embedded = false,
  variant: layoutVariant = 'default',
  editLinks = false,
}: LinkedCampaignsProps) {
  const campaignHref = (id: string) =>
    editLinks ? `/campaigns/${id}/edit` : `/campaigns/${id}`;
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
          'flex items-center gap-2 text-muted-foreground',
          layoutVariant === 'popover' && 'justify-center px-2 py-3 text-xs',
          layoutVariant !== 'popover' && 'text-sm',
          embedded && layoutVariant !== 'popover' ? 'min-h-24 justify-center px-4 py-8' : !embedded && 'py-2'
        )}
      >
        <IconLoader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {embedded && layoutVariant !== 'popover'
          ? 'Loading campaigns…'
          : layoutVariant === 'popover'
            ? 'Loading…'
            : 'Loading linked campaigns...'}
      </div>
    );
  }

  if (error) {
    return (
      <p
        className={cn(
          'leading-relaxed text-destructive',
          layoutVariant === 'popover' ? 'px-2 py-2 text-xs' : 'text-sm',
          embedded && layoutVariant !== 'popover' ? 'px-4 py-3' : layoutVariant !== 'popover' && !embedded && 'py-2'
        )}
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
        <ListStateWrapper revealKey={revealKey}>
          <p
            className={cn(
              'leading-relaxed text-muted-foreground',
              layoutVariant === 'popover' ? 'px-2 py-2 text-xs' : 'px-4 py-3 text-sm'
            )}
          >
            {type === 'platform'
              ? 'No campaigns include this site or app yet.'
              : 'Not linked to any campaigns.'}
          </p>
        </ListStateWrapper>
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
  const isPopover = layoutVariant === 'popover';

  if (embedded) {
    return (
      <ListStateWrapper revealKey={revealKey}>
        <Fragment>
          {isPopover ? (
            <p
              className="px-4 py-3 text-xs leading-relaxed text-muted-foreground"
              id={`linked-campaigns-hint-${entityId}`}
            >
              {editLinks
                ? 'Unlink or replace this content in a campaign (opens edit), then try again.'
                : 'Open a campaign to change or remove its content, then you can delete this item.'}
            </p>
          ) : null}
          <ul className="divide-y divide-border" aria-label={listLabel}>
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={campaignHref(c.id)}
                  className={cn(
                    'flex flex-col gap-2 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row sm:items-center sm:gap-3',
                    isPopover
                      ? 'min-h-12 gap-3 px-4 py-4 text-sm sm:min-h-11'
                      : 'min-h-11 px-4 py-3 text-sm'
                  )}
                >
                  <span className="min-w-0 flex-1 font-medium leading-snug text-foreground sm:truncate">
                    {c.name}
                    <span className="sr-only">
                      {editLinks ? ' — Edit campaign' : ' — Open campaign'}
                    </span>
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-border/80 capitalize tabular-nums',
                        isPopover ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5'
                      )}
                    >
                      {c.campaignType}
                    </Badge>
                    <Badge
                      variant={campaignStatusBadgeVariant(c.status)}
                      className={cn('capitalize tabular-nums', isPopover ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5')}
                    >
                      {c.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Fragment>
      </ListStateWrapper>
    );
  }

  const list = (
    <ul className="space-y-2" aria-label={listLabel}>
      {campaigns.map((c) => (
        <li key={c.id}>
          <Link
            href={campaignHref(c.id)}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border/80 bg-card/30 px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="min-w-0 flex-1 truncate font-medium leading-snug">{c.name}</span>
            <Badge variant="outline" className="shrink-0 capitalize text-xs">
              {c.campaignType}
            </Badge>
            <Badge
              variant={campaignStatusBadgeVariant(c.status)}
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

interface LinkedCampaignsSectionProps {
  type: LinkedCampaignsProps['type'];
  entityId: string;
  /** Heading shown above the card. Defaults to "Linked campaigns". */
  heading?: string;
  /** When true, campaign links go to `/campaigns/[id]/edit`. */
  editLinks?: boolean;
}

/**
 * Standard drawer-body section that shows linked campaigns inside a bordered
 * card. Used across ad / notification / redirect / platform drawers so the
 * layout stays consistent and we avoid repeating the same boilerplate in each.
 */
export function LinkedCampaignsSection({
  type,
  entityId,
  heading = 'Linked campaigns',
  editLinks = false,
}: LinkedCampaignsSectionProps) {
  const headingId = `${type}-campaigns-heading-${entityId}`;
  return (
    <section className="min-w-0 space-y-3" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {heading}
      </h3>
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
        <LinkedCampaigns type={type} entityId={entityId} embedded editLinks={editLinks} />
      </div>
    </section>
  );
}
