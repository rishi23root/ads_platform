'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
} from '@/components/ui/alert-dialog';
import { IconLoader2, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';

interface EndUserRowActionsProps {
  userId: string;
  email: string | null;
  identifier: string | null;
  /** When false, hide delete (non-admin). Default true */
  canDelete?: boolean;
}

export function EndUserRowActions({
  userId,
  email,
  identifier,
  canDelete = true,
}: EndUserRowActionsProps) {
  const deleteLabel = email ?? identifier ?? userId.slice(0, 8);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/end-users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Could not delete user');
        return;
      }
      toast.success('User deleted');
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/users/${userId}`}>View</Link>
        </Button>
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Delete ${deleteLabel}`}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete app user?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              This removes <span className="font-medium text-foreground">{deleteLabel}</span>{' '}
              along with their sign-in session, payments, and related data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
