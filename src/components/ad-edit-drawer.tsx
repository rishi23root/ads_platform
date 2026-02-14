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
import { AdForm } from '@/app/(protected)/ads/ad-form';
import type { Ad } from '@/db/schema';

interface AdEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad?: Ad | null;
  adId?: string;
}

export function AdEditDrawer({ open, onOpenChange, ad, adId }: AdEditDrawerProps) {
  const router = useRouter();
  const [fetchedAd, setFetchedAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const resolvedAd = ad ?? fetchedAd;

  useEffect(() => {
    if (!open) return;
    if (ad) {
      queueMicrotask(() => {
        setFetchedAd(null);
        setFetchError(null);
      });
      return;
    }
    if (!adId) {
      queueMicrotask(() => setFetchError('No ad selected'));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setFetchError(null);
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
        if (!cancelled) return setFetchedAd(data);
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
  }, [open, adId, ad]);

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
          <DrawerTitle>Edit Ad</DrawerTitle>
          <DrawerDescription>Update ad details</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : resolvedAd ? (
            <AdForm
              ad={resolvedAd}
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
