'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  CrudResourceDrawerRoot,
  CrudResourceDrawerHeader,
  CrudResourceDrawerBody,
} from '@/components/crud-resource-drawer';
import { IconLoader2, IconPencil } from '@tabler/icons-react';
import { RedirectForm } from '@/app/(protected)/redirects/redirect-form';
import { LinkedCampaigns } from '@/components/linked-campaigns';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Redirect } from '@/db/schema';

interface RedirectEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirect?: Redirect | null;
  redirectId?: string;
  initialMode?: 'view' | 'edit';
  /** When false, view mode has no Edit control. Use only when `session.role === 'admin'`. Default true */
  showEditAction?: boolean;
  /** Hide Linked campaigns when opened from a campaign detail view. Default false */
  hideLinkedCampaigns?: boolean;
}

const detailRow =
  'grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-start sm:gap-4';
const dtClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

function RedirectEditDrawerContent({
  redirect,
  redirectId,
  initialMode,
  showEditAction = true,
  hideLinkedCampaigns = false,
}: {
  redirect?: Redirect | null;
  redirectId?: string;
  initialMode: 'view' | 'edit';
  showEditAction?: boolean;
  hideLinkedCampaigns?: boolean;
}) {
  const router = useRouter();
  const [fetched, setFetched] = useState<Redirect | null>(null);
  const [patched, setPatched] = useState<Redirect | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);

  const resolved = patched ?? redirect ?? fetched;
  const displayError = !redirect && !redirectId ? 'No redirect selected' : fetchError;

  useEffect(() => {
    if (redirect) return;
    if (!redirectId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setFetchError(null);
      }
    });
    fetch(`/api/redirects/${redirectId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to fetch redirect');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFetched(data);
      })
      .catch((err) => {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : 'Failed to fetch redirect');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [redirectId, redirect]);

  const handleSuccess = async (updated?: Redirect) => {
    if (updated) setPatched(updated);
    setMode('view');
    router.refresh();
  };

  const handleCancel = () => {
    setMode('view');
  };

  const title =
    mode === 'edit'
      ? resolved
        ? `Edit · ${resolved.name}`
        : 'Edit redirect'
      : resolved?.name ?? 'Redirect';
  const description =
    mode === 'view'
      ? 'Routing details and campaigns using this redirect'
      : 'Update source domain and destination';

  const headerActions =
    mode === 'view' && resolved && showEditAction ? (
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
        ) : resolved ? (
          mode === 'view' ? (
            <div className="flex min-w-0 flex-col gap-6">
              <section className="min-w-0 space-y-3" aria-labelledby="redirect-details-heading">
                <h3
                  id="redirect-details-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Details
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
                  <dl className="divide-y divide-border">
                    <div className={detailRow}>
                      <dt className={dtClass}>Name</dt>
                      <dd className="text-sm font-medium leading-snug text-foreground">{resolved.name}</dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Source</dt>
                      <dd className="min-w-0 text-sm">
                        <span className="inline-flex max-w-full break-all rounded-md border border-border/80 bg-muted/35 px-2 py-1 font-mono text-xs leading-normal text-foreground">
                          {resolved.sourceDomain}
                        </span>
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Subdomains</dt>
                      <dd className="text-sm leading-snug text-foreground">
                        {resolved.includeSubdomains ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Destination</dt>
                      <dd className="min-w-0 text-sm">
                        <a
                          href={resolved.destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline break-all"
                        >
                          {resolved.destinationUrl}
                        </a>
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Created</dt>
                      <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                        {formatDateTimeUtcEnGb(resolved.createdAt)}
                      </dd>
                    </div>
                    {new Date(resolved.updatedAt).getTime() !== new Date(resolved.createdAt).getTime() ? (
                      <div className={detailRow}>
                        <dt className={dtClass}>Updated</dt>
                        <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                          {formatDateTimeUtcEnGb(resolved.updatedAt)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </section>
              {!hideLinkedCampaigns ? (
                <section className="min-w-0 space-y-3" aria-labelledby="redirect-campaigns-heading">
                  <h3
                    id="redirect-campaigns-heading"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Linked campaigns
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
                    <LinkedCampaigns type="redirect" entityId={resolved.id} embedded />
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <RedirectForm redirect={resolved} mode="edit" onSuccess={handleSuccess} onCancel={handleCancel} />
          )
        ) : null}
      </CrudResourceDrawerBody>
    </>
  );
}

export function RedirectEditDrawer({
  open,
  onOpenChange,
  redirect,
  redirectId,
  initialMode = 'view',
  showEditAction = true,
  hideLinkedCampaigns = false,
}: RedirectEditDrawerProps) {
  return (
    <CrudResourceDrawerRoot open={open} onOpenChange={onOpenChange} direction="right">
      {open ? (
        <RedirectEditDrawerContent
          key={`${redirectId ?? redirect?.id ?? 'none'}:${initialMode}`}
          redirect={redirect}
          redirectId={redirectId}
          initialMode={initialMode}
          showEditAction={showEditAction}
          hideLinkedCampaigns={hideLinkedCampaigns}
        />
      ) : null}
    </CrudResourceDrawerRoot>
  );
}
