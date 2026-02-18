'use client';

import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { IconPencil, IconAd2, IconBell } from '@tabler/icons-react';

type LinkedContent =
  | { type: 'ad'; id: string; name: string; description: string | null; imageUrl: string | null; targetUrl: string | null }
  | { type: 'notification'; id: string; title: string; message: string; ctaLink: string | null };

interface CampaignLinkedContentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedContent: LinkedContent | null;
  isAdmin?: boolean;
  /** When 'popup', shows "Pop up" instead of "Ad" for ad content */
  campaignType?: string;
}

export function CampaignLinkedContentDrawer({
  open,
  onOpenChange,
  linkedContent,
  isAdmin = false,
  campaignType,
}: CampaignLinkedContentDrawerProps) {
  if (!linkedContent) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle className="flex items-center gap-2 pr-8">
            {linkedContent.type === 'ad' ? (
              <IconAd2 className="h-5 w-5" />
            ) : (
              <IconBell className="h-5 w-5" />
            )}
            {linkedContent.type === 'ad' ? linkedContent.name : linkedContent.title}
          </SheetTitle>
          <SheetDescription>
            {linkedContent.type === 'ad'
              ? campaignType === 'popup'
                ? 'Linked pop up content (same ad, displayed as popup)'
                : 'Linked ad content'
              : 'Linked notification content'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 px-4 pb-6 space-y-6">
          {linkedContent.type === 'ad' && (
            <>
              {linkedContent.imageUrl && (
                <div className="rounded-lg border overflow-hidden my-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={linkedContent.imageUrl}
                    alt={linkedContent.name}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              {linkedContent.description && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                  <p className="text-sm leading-relaxed">{linkedContent.description}</p>
                </div>
              )}
              {linkedContent.targetUrl && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Target URL</p>
                  <a
                    href={linkedContent.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {linkedContent.targetUrl}
                  </a>
                </div>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-4 px-4 py-2" asChild>
                  <Link href={`/ads/${linkedContent.id}/edit`}>
                    <IconPencil className="mr-2 h-4 w-4" />
                    {campaignType === 'popup' ? 'Edit Pop up' : 'Edit Ad'}
                  </Link>
                </Button>
              )}
            </>
          )}

          {linkedContent.type === 'notification' && (
            <>
              <div className="pt-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{linkedContent.message}</p>
              </div>
              {linkedContent.ctaLink && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">CTA Link</p>
                  <a
                    href={linkedContent.ctaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {linkedContent.ctaLink}
                  </a>
                </div>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-4 px-4 py-2" asChild>
                  <Link href={`/notifications/${linkedContent.id}/edit`}>
                    <IconPencil className="mr-2 h-4 w-4" />
                    Edit Notification
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
