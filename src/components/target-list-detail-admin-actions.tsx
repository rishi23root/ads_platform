'use client';

import * as React from 'react';
import Link from 'next/link';
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
} from '@/components/ui/alert-dialog';
import { IconPencil } from '@tabler/icons-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function TargetListDetailAdminActions({
  listId,
  listName,
  campaignsUsing,
  compact = false,
}: {
  listId: string;
  listName: string;
  campaignsUsing: number;
  /** Tighter buttons for dense page headers. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/target-lists/${listId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Delete failed');
      toast.success('Target list deleted');
      setOpen(false);
      router.push('/target-lists');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className={cn('flex flex-wrap items-center', compact ? 'gap-2' : 'gap-3')}>
        <Button
          variant="outline"
          size="sm"
          className={compact ? 'h-8 min-h-8 px-2.5' : 'min-h-9 px-3'}
          asChild
        >
          <Link href={`/target-lists/${listId}/edit`}>
            <IconPencil className={compact ? 'mr-1 h-3.5 w-3.5' : 'mr-1.5 h-4 w-4'} />
            Edit
          </Link>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className={compact ? 'h-8 min-h-8 px-2.5' : 'min-h-9 px-3'}
          onClick={() => setOpen(true)}
        >
          Delete
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete target list?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{listName}&quot;? {campaignsUsing} campaign
              {campaignsUsing === 1 ? '' : 's'} currently reference this list; their target list will be
              cleared (audience falls back to the campaign&apos;s other rules).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(ev) => {
                ev.preventDefault();
                void handleDelete();
              }}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
