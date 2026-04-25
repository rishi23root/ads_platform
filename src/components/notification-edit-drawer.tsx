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
import { NotificationForm } from '@/app/(protected)/notifications/notification-form';
import { LinkedCampaignsSection } from '@/components/linked-campaigns';
import { cn, formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Notification } from '@/db/schema';

interface NotificationEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification?: Notification | null;
  notificationId?: string;
  initialMode?: 'view' | 'edit';
  /** When false, view mode has no Edit control. Use only when `session.role === 'admin'`. Default true */
  showEditAction?: boolean;
}

const detailRow =
  'grid gap-1 px-4 py-3 sm:grid-cols-[minmax(7.5rem,9.5rem)_1fr] sm:items-start sm:gap-4';
const dtClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

function emptyDash(className?: string) {
  return <span className={cn('text-muted-foreground', className)}>—</span>;
}

function NotificationEditDrawerContent({
  notification,
  notificationId,
  initialMode,
  showEditAction = true,
}: {
  notification?: Notification | null;
  notificationId?: string;
  initialMode: 'view' | 'edit';
  showEditAction?: boolean;
}) {
  const router = useRouter();
  const [fetchedNotification, setFetchedNotification] = useState<Notification | null>(null);
  const [patchedNotification, setPatchedNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<'view' | 'edit'>(
    showEditAction ? initialMode : 'view'
  );
  if (!showEditAction && internalMode === 'edit') {
    setInternalMode('view');
  }
  const mode = showEditAction ? internalMode : 'view';

  const resolvedNotification = patchedNotification ?? notification ?? fetchedNotification;
  const displayError = !notification && !notificationId ? 'No notification selected' : fetchError;

  useEffect(() => {
    if (notification) return;
    if (!notificationId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setFetchError(null);
      }
    });
    fetch(`/api/notifications/${notificationId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to fetch notification');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFetchedNotification(data);
      })
      .catch((err) => {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : 'Failed to fetch notification');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notificationId, notification]);

  const handleSuccess = async (updated?: Notification) => {
    if (updated) setPatchedNotification(updated);
    setInternalMode('view');
    router.refresh();
  };

  const handleCancel = () => {
    setInternalMode('view');
  };

  const title =
    mode === 'edit'
      ? resolvedNotification
        ? `Edit · ${resolvedNotification.title}`
        : 'Edit notification'
      : resolvedNotification?.title ?? 'Notification';
  const description =
    mode === 'view'
      ? 'Message details and campaigns using this notification'
      : 'Update title, message, and CTA';

  const headerActions =
    mode === 'view' && resolvedNotification && showEditAction ? (
      <Button type="button" size="sm" variant="outline" onClick={() => setInternalMode('edit')}>
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
        ) : resolvedNotification ? (
          mode === 'view' ? (
            <div className="flex min-w-0 flex-col gap-6">
              <section className="min-w-0 space-y-3" aria-labelledby="notification-details-heading">
                <h3
                  id="notification-details-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Details
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/80 bg-card/40">
                  <dl className="divide-y divide-border">
                    <div className={detailRow}>
                      <dt className={dtClass}>Title</dt>
                      <dd className="text-sm font-medium leading-snug text-foreground">
                        {resolvedNotification.title?.trim()
                          ? resolvedNotification.title
                          : emptyDash('text-sm')}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Message</dt>
                      <dd className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {resolvedNotification.message?.trim()
                          ? resolvedNotification.message
                          : emptyDash('text-sm')}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>CTA link</dt>
                      <dd className="min-w-0 text-sm">
                        {resolvedNotification.ctaLink?.trim() ? (
                          <a
                            href={resolvedNotification.ctaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-4 hover:underline break-all"
                          >
                            {resolvedNotification.ctaLink}
                          </a>
                        ) : (
                          emptyDash()
                        )}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Created</dt>
                      <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                        {formatDateTimeUtcEnGb(resolvedNotification.createdAt)}
                      </dd>
                    </div>
                    <div className={detailRow}>
                      <dt className={dtClass}>Updated</dt>
                      <dd className="text-sm tabular-nums leading-snug text-muted-foreground" title="UTC">
                        {formatDateTimeUtcEnGb(resolvedNotification.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
              <LinkedCampaignsSection type="notification" entityId={resolvedNotification.id} />
            </div>
          ) : (
            <NotificationForm
              notification={resolvedNotification}
              mode="edit"
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )
        ) : null}
      </CrudResourceDrawerBody>
    </>
  );
}

export function NotificationEditDrawer({
  open,
  onOpenChange,
  notification,
  notificationId,
  initialMode = 'view',
  showEditAction = true,
}: NotificationEditDrawerProps) {
  return (
    <CrudResourceDrawerRoot open={open} onOpenChange={onOpenChange} direction="right">
      {open ? (
        <NotificationEditDrawerContent
          key={`${notificationId ?? notification?.id ?? 'none'}:${initialMode}`}
          notification={notification}
          notificationId={notificationId}
          initialMode={initialMode}
          showEditAction={showEditAction}
        />
      ) : null}
    </CrudResourceDrawerRoot>
  );
}
