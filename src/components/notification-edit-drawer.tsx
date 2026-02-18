'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { IconLoader2, IconPencil } from '@tabler/icons-react';
import { NotificationForm } from '@/app/(protected)/notifications/notification-form';
import { LinkedCampaigns } from '@/components/linked-campaigns';
import type { Notification } from '@/db/schema';

interface NotificationEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification?: Notification | null;
  notificationId?: string;
  /** When 'edit', opens directly in edit mode (e.g. from campaign's edit button). Default: 'view' */
  initialMode?: 'view' | 'edit';
}

/** Inner content with its own state; keyed to reset when opening for a different notification/mode */
function NotificationEditDrawerContent({
  notification,
  notificationId,
  initialMode,
  onOpenChange,
}: {
  notification?: Notification | null;
  notificationId?: string;
  initialMode: 'view' | 'edit';
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [fetchedNotification, setFetchedNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);

  const resolvedNotification = notification ?? fetchedNotification;
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

  const handleSuccess = async () => {
    setMode('view');
    onOpenChange(false);
    router.refresh();
  };

  const handleCancel = () => {
    setMode('view');
    onOpenChange(false);
  };

  const handleSwitchToEdit = () => {
    setMode('edit');
  };

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{mode === 'view' ? 'Notification' : 'Edit Notification'}</DrawerTitle>
        <DrawerDescription>
          {mode === 'view' ? 'View notification details and linked campaigns' : 'Update notification details'}
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayError ? (
          <p className="text-sm text-destructive">{displayError}</p>
        ) : resolvedNotification ? (
          mode === 'view' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Title</p>
                <p className="text-base font-medium">{resolvedNotification.title}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Message</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{resolvedNotification.message}</p>
              </div>
              {resolvedNotification.ctaLink && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">CTA Link</p>
                  <a
                    href={resolvedNotification.ctaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {resolvedNotification.ctaLink}
                  </a>
                </div>
              )}
              <div className="pt-2 border-t">
                <LinkedCampaigns type="notification" entityId={resolvedNotification.id} />
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleSwitchToEdit}>
                <IconPencil className="mr-2 h-4 w-4" />
                Edit Notification
              </Button>
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
      </div>
    </>
  );
}

export function NotificationEditDrawer({
  open,
  onOpenChange,
  notification,
  notificationId,
  initialMode = 'view',
}: NotificationEditDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full flex-col border-l data-[vaul-drawer-direction=right]:h-full data-[vaul-drawer-direction=right]:max-h-none data-[vaul-drawer-direction=right]:sm:max-w-xl">
        {open && (
          <NotificationEditDrawerContent
            key={`${notificationId ?? notification?.id ?? 'none'}-${initialMode}`}
            notification={notification}
            notificationId={notificationId}
            initialMode={initialMode}
            onOpenChange={onOpenChange}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
