'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconPencil } from '@tabler/icons-react';
import { AdEditDrawer } from '@/components/ad-edit-drawer';
import { NotificationEditDrawer } from '@/components/notification-edit-drawer';
import type { Ad } from '@/db/schema';
import type { Notification } from '@/db/schema';

interface CampaignLinkedContentEditProps {
  ad?: Ad | null;
  notification?: Notification | null;
}

export function CampaignLinkedContentEdit({ ad, notification }: CampaignLinkedContentEditProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!ad && !notification) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDrawerOpen(true)}
      >
        <IconPencil className="h-4 w-4" />
      </Button>
      {ad ? (
        <AdEditDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          ad={ad}
          initialMode="edit"
        />
      ) : notification ? (
        <NotificationEditDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          notification={notification}
          initialMode="edit"
        />
      ) : null}
    </>
  );
}
