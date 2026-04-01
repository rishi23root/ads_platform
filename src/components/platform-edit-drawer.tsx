'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { IconLoader2, IconPencil } from '@tabler/icons-react';
import { PlatformForm } from '@/app/(protected)/platforms/platform-form';
import {
  CrudResourceDrawerRoot,
  CrudResourceDrawerHeader,
  CrudResourceDrawerBody,
} from '@/components/crud-resource-drawer';
import { LinkedCampaigns } from '@/components/linked-campaigns';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Platform } from '@/db/schema';

export type PlatformDrawerRow = Platform & { linkedCampaignCount?: number };

interface PlatformEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform?: PlatformDrawerRow | null;
  platformId?: string;
  /** Deep-link / explicit edit entry */
  initialMode?: 'view' | 'edit';
  /** When false, view mode has no Edit control (non-admin). Default true */
  showEditAction?: boolean;
}

function PlatformEditDrawerContent({
  platform,
  platformId,
  initialMode,
  showEditAction = true,
}: {
  platform?: PlatformDrawerRow | null;
  platformId?: string;
  initialMode: 'view' | 'edit';
  showEditAction?: boolean;
}) {
  const router = useRouter();
  const [fetchedPlatform, setFetchedPlatform] = useState<Platform | null>(null);
  const [patchedPlatform, setPatchedPlatform] = useState<Platform | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(showEditAction ? initialMode : 'view');

  const resolvedPlatform = patchedPlatform ?? platform ?? fetchedPlatform;
  const displayError = !platform && !platformId ? 'No platform selected' : fetchError;

  useEffect(() => {
    if (platform) {
      queueMicrotask(() => {
        setFetchedPlatform(null);
        setFetchError(null);
      });
      return;
    }
    if (!platformId) {
      queueMicrotask(() => setFetchError('No platform selected'));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setFetchError(null);
    });
    fetch(`/api/platforms/${platformId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to fetch platform');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFetchedPlatform(data);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to fetch platform');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [platformId, platform]);

  useEffect(() => {
    if (!showEditAction && mode === 'edit') {
      setMode('view');
    }
  }, [showEditAction, mode]);

  const handleSuccess = async (updated?: Platform) => {
    if (updated) setPatchedPlatform(updated);
    setMode('view');
    router.refresh();
  };

  const handleCancelEdit = () => {
    setMode('view');
  };

  const title =
    mode === 'edit'
      ? resolvedPlatform
        ? `Edit · ${resolvedPlatform.name}`
        : 'Edit platform'
      : resolvedPlatform?.name ?? 'Platform';
  const description =
    mode === 'view' ? 'Details and campaigns that target this platform' : 'Update name and domain';

  const headerActions =
    mode === 'view' && resolvedPlatform && showEditAction ? (
      <Button type="button" size="sm" variant="outline" onClick={() => setMode('edit')}>
        <IconPencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
    ) : mode === 'edit' ? (
      <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit}>
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
        ) : resolvedPlatform ? (
          mode === 'view' ? (
            <div className="flex min-w-0 flex-col gap-6">
              <section className="min-w-0 space-y-3" aria-labelledby="platform-details-heading">
                <h3
                  id="platform-details-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Details
                </h3>
                <dl className="divide-y divide-border rounded-lg border border-border/80 bg-card/40">
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-start sm:gap-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</dt>
                    <dd className="text-sm font-medium leading-snug text-foreground">{resolvedPlatform.name}</dd>
                  </div>
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-start sm:gap-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Domain</dt>
                    <dd className="min-w-0 text-sm">
                      {resolvedPlatform.domain ? (
                        <span className="inline-flex max-w-full break-all rounded-md border border-border/80 bg-muted/35 px-2 py-1 font-mono text-xs leading-normal text-foreground sm:break-normal">
                          {resolvedPlatform.domain}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-start sm:gap-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
                    <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                      {formatDateTimeUtcEnGb(resolvedPlatform.createdAt)}
                    </dd>
                  </div>
                  {new Date(resolvedPlatform.updatedAt).getTime() !==
                  new Date(resolvedPlatform.createdAt).getTime() ? (
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-start sm:gap-4">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</dt>
                      <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                        {formatDateTimeUtcEnGb(resolvedPlatform.updatedAt)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
              <section className="min-w-0 space-y-3" aria-labelledby="platform-campaigns-heading">
                <h3
                  id="platform-campaigns-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Targeted by campaigns
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
                  <LinkedCampaigns type="platform" entityId={resolvedPlatform.id} embedded />
                </div>
              </section>
            </div>
          ) : (
            <PlatformForm
              platform={resolvedPlatform}
              mode="edit"
              onSuccess={handleSuccess}
              onCancel={handleCancelEdit}
            />
          )
        ) : null}
      </CrudResourceDrawerBody>
    </>
  );
}

export function PlatformEditDrawer({
  open,
  onOpenChange,
  platform,
  platformId,
  initialMode = 'view',
  showEditAction = true,
}: PlatformEditDrawerProps) {
  const key = `${platformId ?? platform?.id ?? 'none'}:${initialMode}`;
  return (
    <CrudResourceDrawerRoot open={open} onOpenChange={onOpenChange} direction="right">
      {open ? (
        <PlatformEditDrawerContent
          key={key}
          platform={platform}
          platformId={platformId}
          initialMode={initialMode}
          showEditAction={showEditAction}
        />
      ) : null}
    </CrudResourceDrawerRoot>
  );
}
