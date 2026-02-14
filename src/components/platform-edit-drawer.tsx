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
import { PlatformForm } from '@/app/(protected)/platforms/platform-form';
import type { Platform } from '@/db/schema';

interface PlatformEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform?: Platform | null;
  platformId?: string;
}

export function PlatformEditDrawer({ open, onOpenChange, platform, platformId }: PlatformEditDrawerProps) {
  const router = useRouter();
  const [fetchedPlatform, setFetchedPlatform] = useState<Platform | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const resolvedPlatform = platform ?? fetchedPlatform;

  useEffect(() => {
    if (!open) return;
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
        if (!cancelled) return setFetchedPlatform(data);
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
  }, [open, platformId, platform]);

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
          <DrawerTitle>Edit Platform</DrawerTitle>
          <DrawerDescription>Update platform details</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : resolvedPlatform ? (
            <PlatformForm
              platform={resolvedPlatform}
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
