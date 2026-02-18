'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { IconAd2, IconBell } from '@tabler/icons-react';
import { CampaignLinkedContentDrawer } from './CampaignLinkedContentDrawer';

type LinkedContent =
  | { type: 'ad'; id: string; name: string; description: string | null; imageUrl: string | null; targetUrl: string | null }
  | { type: 'notification'; id: string; title: string; message: string; ctaLink: string | null };

interface LinkedContentCardProps {
  linkedContent: LinkedContent | null;
  isAdmin?: boolean;
  /** When 'popup', shows "Pop up" instead of "Ad" for ad content */
  campaignType?: string;
}

export function LinkedContentCard({ linkedContent, isAdmin = false, campaignType }: LinkedContentCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!linkedContent) {
    return (
      <div className="min-h-[88px] rounded-lg border border-dashed bg-muted/30 px-4 py-3 flex flex-col justify-center">
        <p className="text-xs font-medium text-muted-foreground">Linked Content</p>
        <p className="text-sm text-muted-foreground mt-1">No ad or notification linked</p>
      </div>
    );
  }

  const isAd = linkedContent.type === 'ad';
  const isPopup = isAd && campaignType === 'popup';
  const label = isAd ? (isPopup ? 'Pop up' : 'Ad') : 'Notification';

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="min-h-[88px] rounded-lg border bg-card px-4 py-3 flex flex-col justify-center text-left w-full hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={isAd ? 'default' : 'secondary'} className="text-xs gap-1">
            {isAd ? <IconAd2 className="h-3 w-3" /> : <IconBell className="h-3 w-3" />}
            {label}
          </Badge>
        </div>
        {isAd ? (
          <div className="flex gap-3 items-center min-w-0">
            {linkedContent.imageUrl && (
              <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={linkedContent.imageUrl}
                  alt={linkedContent.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{linkedContent.name}</p>
              {linkedContent.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {linkedContent.description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{linkedContent.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {linkedContent.message}
            </p>
          </div>
        )}
      </button>
      <CampaignLinkedContentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        linkedContent={linkedContent}
        isAdmin={isAdmin}
        campaignType={campaignType}
      />
    </>
  );
}
