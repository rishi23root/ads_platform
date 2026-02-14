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
import { IconLoader2 } from '@tabler/icons-react';
import { NotificationForm } from '@/app/(protected)/notifications/notification-form';
import type { Notification } from '@/db/schema';

interface NotificationEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification?: Notification | null;
  notificationId?: string;
}

export function NotificationEditDrawer({
  open,
  onOpenChange,
  notification,
  notificationId,
}: NotificationEditDrawerProps) {
  const router = useRouter();
  const [fetchedNotification, setFetchedNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const resolvedNotification = notification ?? fetchedNotification;

  useEffect(() => {
    if (!open) return;
    if (notification) {
      queueMicrotask(() => {
        setFetchedNotification(null);
        setFetchError(null);
      });
      return;
    }
    if (!notificationId) {
      queueMicrotask(() => setFetchError('No notification selected'));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setFetchError(null);
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
        if (!cancelled) return setFetchedNotification(data);
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
  }, [open, notificationId, notification]);

  const handleSuccess = async () => {
    onOpenChange(false);
    router.refresh();
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full flex-col border-l data-[vaul-drawer-direction=right]:h-full data-[vaul-drawer-direction=right]:max-h-none data-[vaul-drawer-direction=right]:sm:max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Edit Notification</DrawerTitle>
          <DrawerDescription>Update notification details</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : resolvedNotification ? (
            <NotificationForm
              notification={resolvedNotification}
              mode="edit"
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
