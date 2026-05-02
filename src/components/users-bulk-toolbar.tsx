'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type TargetListOption = { id: string; name: string };

export function UsersBulkToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [lists, setLists] = React.useState<TargetListOption[]>([]);
  const [listsLoading, setListsLoading] = React.useState(false);
  const [addListId, setAddListId] = React.useState<string>('');
  const [removeListId, setRemoveListId] = React.useState<string>('');
  const [pending, setPending] = React.useState(false);

  const loadLists = React.useCallback(async () => {
    setListsLoading(true);
    try {
      const res = await fetch('/api/target-lists');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load lists');
      const raw = Array.isArray(data) ? data : [];
      setLists(
        raw.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audience lists');
      setLists([]);
    } finally {
      setListsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (addOpen || removeOpen) void loadLists();
  }, [addOpen, removeOpen, loadLists]);

  const runAdd = async () => {
    if (!addListId) {
      toast.error('Choose an audience list');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/target-lists/${addListId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Add failed');
      toast.success(`Added ${selectedIds.length} user(s) to list`);
      setAddOpen(false);
      setAddListId('');
      onClear();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setPending(false);
    }
  };

  const runRemove = async () => {
    if (!removeListId) {
      toast.error('Choose an audience list');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/target-lists/${removeListId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Remove failed');
      toast.success(`Updated list for ${selectedIds.length} user(s)`);
      setRemoveOpen(false);
      setRemoveListId('');
      onClear();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setPending(false);
    }
  };

  const runDelete = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/end-users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Delete failed');
      const n = typeof data.deletedCount === 'number' ? data.deletedCount : selectedIds.length;
      toast.success(`Deleted ${n} user(s)`);
      setDeleteOpen(false);
      onClear();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setPending(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div
        className="motion-safe:transition-opacity flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
        role="region"
        aria-label="Bulk actions for selected users"
      >
        <span className="text-muted-foreground tabular-nums">
          {selectedIds.length} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="default" size="sm" className="h-8" onClick={() => setAddOpen(true)}>
            Add to audience list
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setRemoveOpen(true)}>
            Remove from list
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete users
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to audience list</DialogTitle>
            <DialogDescription>
              Add {selectedIds.length} selected user(s) as explicit members. They will be removed from the
              list&apos;s exclusions if present.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Select
              value={addListId || undefined}
              onValueChange={setAddListId}
              disabled={listsLoading || lists.length === 0}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder={listsLoading ? 'Loading lists…' : 'Choose a list'} />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={pending || !addListId} onClick={() => void runAdd()}>
              {pending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from audience list</DialogTitle>
            <DialogDescription>
              Users who still match the list filter will be excluded from the list so they no longer qualify.
              Explicit members are removed from the member list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Select
              value={removeListId || undefined}
              onValueChange={setRemoveListId}
              disabled={listsLoading || lists.length === 0}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder={listsLoading ? 'Loading lists…' : 'Choose a list'} />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={pending || !removeListId} onClick={() => void runRemove()}>
              {pending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} user(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes these app users and related data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(ev) => {
                ev.preventDefault();
                void runDelete();
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
