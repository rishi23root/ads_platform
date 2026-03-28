'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  CrudResourceDrawerRoot,
  CrudResourceDrawerHeader,
  CrudResourceDrawerBody,
} from '@/components/crud-resource-drawer';
import { IconLoader2, IconPencil } from '@tabler/icons-react';
import { AdForm } from '@/app/(protected)/ads/ad-form';
import { LinkedCampaigns } from '@/components/linked-campaigns';
import { cn, formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Ad } from '@/db/schema';

interface AdEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad?: Ad | null;
  adId?: string;
  /** When 'edit', opens directly in edit mode (e.g. from campaign's edit button). Default: 'view' */
  initialMode?: 'view' | 'edit';
  /** When false, view mode has no Edit control. Use only when `session.role === 'admin'`. Default true */
  showEditAction?: boolean;
  /** Hide Linked campaigns (e.g. opened from a campaign page where context is obvious). Default false */
  hideLinkedCampaigns?: boolean;
}

const detailRow =
  'grid gap-1 px-4 py-3 sm:grid-cols-[minmax(7.5rem,9.5rem)_1fr] sm:items-start sm:gap-4';
const dtClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

function emptyDash(className?: string) {
  return <span className={cn('text-muted-foreground tabular-nums', className)}>—</span>;
}

function AdEditDrawerContent({
  ad,
  adId,
  initialMode,
  showEditAction = true,
  hideLinkedCampaigns = false,
}: {
  ad?: Ad | null;
  adId?: string;
  initialMode: 'view' | 'edit';
  showEditAction?: boolean;
  hideLinkedCampaigns?: boolean;
}) {
  const router = useRouter();
  const [fetchedAd, setFetchedAd] = useState<Ad | null>(null);
  const [patchedAd, setPatchedAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [imageError, setImageError] = useState(false);

  const resolvedAd = patchedAd ?? ad ?? fetchedAd;
  const displayError = !ad && !adId ? 'No ad selected' : fetchError;

  const imageKey = `${resolvedAd?.id ?? ''}:${resolvedAd?.imageUrl ?? ''}`;
  const [prevImageKey, setPrevImageKey] = useState(imageKey);
  if (imageKey !== prevImageKey) {
    setPrevImageKey(imageKey);
    setImageError(false);
  }

  useEffect(() => {
    if (ad) return;
    if (!adId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setFetchError(null);
      }
    });
    fetch(`/api/ads/${adId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to fetch ad');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFetchedAd(data);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to fetch ad');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adId, ad]);

  const handleSuccess = async (updated?: Ad) => {
    if (updated) setPatchedAd(updated);
    setMode('view');
    router.refresh();
  };

  const handleCancel = () => {
    setMode('view');
  };

  const title =
    mode === 'edit'
      ? resolvedAd
        ? `Edit · ${resolvedAd.name}`
        : 'Edit ad'
      : resolvedAd?.name ?? 'Ad';
  const description =
    mode === 'view' ? 'Creative details and campaigns using this ad' : 'Update creative and links';

  const headerActions =
    mode === 'view' && resolvedAd && showEditAction ? (
      <Button type="button" size="sm" variant="outline" onClick={() => setMode('edit')}>
        <IconPencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
    ) : mode === 'edit' ? (
      <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
        Back to details
      </Button>
    ) : null;

  return (
    <>
      <CrudResourceDrawerHeader title={title} description={description} actions={headerActions} />
      <CrudResourceDrawerBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayError ? (
          <p className="text-sm text-destructive">{displayError}</p>
        ) : resolvedAd ? (
          mode === 'view' ? (
            <div className="flex min-w-0 flex-col gap-6">
              <section className="min-w-0 space-y-3" aria-labelledby="ad-details-heading">
                <h3
                  id="ad-details-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Details
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
                  <dl className="divide-y divide-border">
                    <div className={detailRow}>
                      <dt className={dtClass}>Name</dt>
                      <dd className="text-sm font-medium leading-snug text-foreground">{resolvedAd.name}</dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Description</dt>
                      <dd className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {resolvedAd.description?.trim()
                          ? resolvedAd.description
                          : emptyDash('text-sm')}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Target URL</dt>
                      <dd className="min-w-0 text-sm">
                        {resolvedAd.targetUrl?.trim() ? (
                          <a
                            href={resolvedAd.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-4 hover:underline break-all"
                          >
                            {resolvedAd.targetUrl}
                          </a>
                        ) : (
                          emptyDash()
                        )}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Image URL</dt>
                      <dd className="min-w-0 text-sm">
                        {resolvedAd.imageUrl?.trim() ? (
                          <span className="inline-flex max-w-full break-all rounded-md border border-border/80 bg-muted/35 px-2 py-1 font-mono text-xs leading-normal text-foreground">
                            {resolvedAd.imageUrl}
                          </span>
                        ) : (
                          emptyDash('font-mono text-xs')
                        )}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>HTML code</dt>
                      <dd className="min-w-0 text-sm">
                        {resolvedAd.htmlCode?.trim() ? (
                          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
                            {resolvedAd.htmlCode}
                          </pre>
                        ) : (
                          emptyDash('font-mono text-xs')
                        )}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Created</dt>
                      <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                        {formatDateTimeUtcEnGb(resolvedAd.createdAt)}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Updated</dt>
                      <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                        {formatDateTimeUtcEnGb(resolvedAd.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                  {resolvedAd.imageUrl ? (
                    <div className="border-t border-border px-4 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Image preview
                      </p>
                      <div className="relative aspect-video max-w-sm overflow-hidden rounded-md border bg-muted/30 min-h-[120px]">
                        {imageError ? (
                          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                            Could not load image
                          </p>
                        ) : (
                          <Image
                            src={resolvedAd.imageUrl}
                            alt={`Preview for ${resolvedAd.name}`}
                            fill
                            className="object-contain"
                            unoptimized
                            onError={() => setImageError(true)}
                          />
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
              {!hideLinkedCampaigns ? (
                <section className="min-w-0 space-y-3" aria-labelledby="ad-campaigns-heading">
                  <h3
                    id="ad-campaigns-heading"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Linked campaigns
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
                    <LinkedCampaigns type="ad" entityId={resolvedAd.id} embedded />
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <AdForm ad={resolvedAd} mode="edit" onSuccess={handleSuccess} onCancel={handleCancel} />
          )
        ) : null}
      </CrudResourceDrawerBody>
    </>
  );
}

export function AdEditDrawer({
  open,
  onOpenChange,
  ad,
  adId,
  initialMode = 'view',
  showEditAction = true,
  hideLinkedCampaigns = false,
}: AdEditDrawerProps) {
  return (
    <CrudResourceDrawerRoot open={open} onOpenChange={onOpenChange} direction="right">
      {open ? (
        <AdEditDrawerContent
          key={`${adId ?? ad?.id ?? 'none'}:${initialMode}`}
          ad={ad}
          adId={adId}
          initialMode={initialMode}
          showEditAction={showEditAction}
          hideLinkedCampaigns={hideLinkedCampaigns}
        />
      ) : null}
    </CrudResourceDrawerRoot>
  );
}
