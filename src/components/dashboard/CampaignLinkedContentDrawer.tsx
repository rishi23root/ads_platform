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
}

export function CampaignLinkedContentDrawer({
  open,
  onOpenChange,
  linkedContent,
  isAdmin = false,
}: CampaignLinkedContentDrawerProps) {
  if (!linkedContent) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {linkedContent.type === 'ad' ? (
              <IconAd2 className="h-5 w-5" />
            ) : (
              <IconBell className="h-5 w-5" />
            )}
            {linkedContent.type === 'ad' ? linkedContent.name : linkedContent.title}
          </SheetTitle>
          <SheetDescription>
            {linkedContent.type === 'ad' ? 'Linked ad content' : 'Linked notification content'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {linkedContent.type === 'ad' && (
            <>
              {linkedContent.imageUrl && (
                <div className="rounded-lg border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={linkedContent.imageUrl}
                    alt={linkedContent.name}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              {linkedContent.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{linkedContent.description}</p>
                </div>
              )}
              {linkedContent.targetUrl && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Target URL</p>
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
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/ads/${linkedContent.id}/edit`}>
                    <IconPencil className="mr-2 h-4 w-4" />
                    Edit Ad
                  </Link>
                </Button>
              )}
            </>
          )}

          {linkedContent.type === 'notification' && (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Message</p>
                <p className="text-sm whitespace-pre-wrap">{linkedContent.message}</p>
              </div>
              {linkedContent.ctaLink && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">CTA Link</p>
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
                <Button variant="outline" size="sm" asChild>
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
