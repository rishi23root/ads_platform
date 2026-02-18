'use client';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { PlatformForm, type NewPlatformResult } from '@/app/(protected)/platforms/platform-form';

interface PlatformAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newPlatform: NewPlatformResult) => void;
}

export function PlatformAddDrawer({ open, onOpenChange, onSuccess }: PlatformAddDrawerProps) {
  const handleSuccess = async (newPlatform?: NewPlatformResult) => {
    onOpenChange(false);
    if (newPlatform) {
      onSuccess?.(newPlatform);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full flex-col border-l data-[vaul-drawer-direction=right]:h-full data-[vaul-drawer-direction=right]:max-h-none data-[vaul-drawer-direction=right]:sm:max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Add New Platform</DrawerTitle>
          <DrawerDescription>Create a new domain/platform for targeting</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
          <PlatformForm
            mode="create"
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
