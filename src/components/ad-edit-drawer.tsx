'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
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
import { AdForm } from '@/app/(protected)/ads/ad-form';
import { LinkedCampaigns } from '@/components/linked-campaigns';
import type { Ad } from '@/db/schema';

interface AdEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad?: Ad | null;
  adId?: string;
  /** When 'edit', opens directly in edit mode (e.g. from campaign's edit button). Default: 'view' */
  initialMode?: 'view' | 'edit';
}

/** Inner content with its own state; keyed to reset when opening for a different ad/mode */
function AdEditDrawerContent({
  ad,
  adId,
  initialMode,
  onOpenChange,
}: {
  ad?: Ad | null;
  adId?: string;
  initialMode: 'view' | 'edit';
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [fetchedAd, setFetchedAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [imageError, setImageError] = useState(false);

  const resolvedAd = ad ?? fetchedAd;
  const displayError = !ad && !adId ? 'No ad selected' : fetchError;

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
        <DrawerTitle>{mode === 'view' ? 'Ad' : 'Edit Ad'}</DrawerTitle>
        <DrawerDescription>
          {mode === 'view' ? 'View ad details and linked campaigns' : 'Update ad details'}
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayError ? (
          <p className="text-sm text-destructive">{displayError}</p>
        ) : resolvedAd ? (
          mode === 'view' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-base font-medium">{resolvedAd.name}</p>
              </div>
              {resolvedAd.description && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{resolvedAd.description}</p>
                </div>
              )}
              {resolvedAd.imageUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Image</p>
                  <div className="rounded-md border overflow-hidden max-w-sm aspect-video relative bg-muted/30 min-h-[120px]">
                    {imageError ? (
                      <p className="text-sm text-muted-foreground px-4 text-center absolute inset-0 flex items-center justify-center">
                        Could not load image
                      </p>
                    ) : (
                      <Image
                        src={resolvedAd.imageUrl}
                        alt={resolvedAd.name}
                        fill
                        className="object-contain"
                        unoptimized
                        onError={() => setImageError(true)}
                      />
                    )}
                  </div>
                </div>
              )}
              {resolvedAd.targetUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Target URL</p>
                  <a
                    href={resolvedAd.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {resolvedAd.targetUrl}
                  </a>
                </div>
              )}
              {resolvedAd.htmlCode && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">HTML code</p>
                  <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
                    {resolvedAd.htmlCode}
                  </pre>
                </div>
              )}
              <div className="pt-2 border-t">
                <LinkedCampaigns type="ad" entityId={resolvedAd.id} />
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleSwitchToEdit}>
                <IconPencil className="mr-2 h-4 w-4" />
                Edit Ad
              </Button>
            </div>
          ) : (
            <AdForm
              ad={resolvedAd}
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

export function AdEditDrawer({ open, onOpenChange, ad, adId, initialMode = 'view' }: AdEditDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full flex-col border-l data-[vaul-drawer-direction=right]:h-full data-[vaul-drawer-direction=right]:max-h-none data-[vaul-drawer-direction=right]:sm:max-w-xl">
        {open && (
          <AdEditDrawerContent
            key={`${adId ?? ad?.id ?? 'none'}-${initialMode}`}
            ad={ad}
            adId={adId}
            initialMode={initialMode}
            onOpenChange={onOpenChange}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
