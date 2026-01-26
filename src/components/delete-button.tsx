'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { IconTrash, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';

interface DeleteButtonProps {
  id: string;
  name: string;
  entityType: 'ad' | 'platform' | 'notification';
  apiPath: string;
}

const entityLabels = {
  ad: {
    title: 'Delete Ad',
    successMessage: 'Ad deleted successfully',
    errorMessage: 'Failed to delete ad',
  },
  platform: {
    title: 'Delete Platform',
    successMessage: 'Platform deleted successfully',
    errorMessage: 'Failed to delete platform',
  },
  notification: {
    title: 'Delete Notification',
    successMessage: 'Notification deleted successfully',
    errorMessage: 'Failed to delete notification',
  },
};

export function DeleteButton({ name, entityType, apiPath }: DeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const labels = entityLabels[entityType];

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(apiPath, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || labels.errorMessage);
      }

      toast.success(labels.successMessage);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <IconTrash className="h-4 w-4" />
          <span className="sr-only">Delete {entityType}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
