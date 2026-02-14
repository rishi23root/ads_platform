'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import { AdForm } from '@/app/(protected)/ads/ad-form';
import { NotificationForm } from '@/app/(protected)/notifications/notification-form';

interface CampaignContentDrawerProps {
  campaignId: string;
  type: 'ad' | 'notification';
}

export function CampaignContentDrawer({ campaignId, type }: CampaignContentDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleAdSuccess = async (adId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to link ad');
    }
    toast.success('Ad created and linked to campaign');
    setOpen(false);
    router.refresh();
  };

  const handleNotificationSuccess = async (notificationId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to link notification');
    }
    toast.success('Notification created and linked to campaign');
    setOpen(false);
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <IconPlus className="mr-1 h-4 w-4" />
          Add {type === 'ad' ? 'Ad' : 'Notification'}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add {type === 'ad' ? 'Ad' : 'Notification'}</SheetTitle>
          <SheetDescription>
            Create a new {type} and link it to this campaign
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          {type === 'ad' ? (
            <AdForm
              mode="create"
              onSuccess={handleAdSuccess}
            />
          ) : (
            <NotificationForm
              mode="create"
              onSuccess={handleNotificationSuccess}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
