'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableSurface } from '@/components/ui/data-table-surface';
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
import { IconEye, IconPencil, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';

export type TargetListTableRow = {
  id: string;
  name: string;
  filterSummary: string;
  /** Users matching filter and/or explicit members, minus exclusions. */
  qualifyingCount: number;
  explicitMemberCount: number;
  campaignsUsing: number;
  updatedAt: string;
};

export function TargetListsTable({
  rows,
  isAdmin,
}: {
  rows: TargetListTableRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const rowToDelete = rows.find((r) => r.id === deleteId) ?? null;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/target-lists/${deleteId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Delete failed');
      toast.success('Audience list deleted');
      setDeleteId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No audience lists yet.{' '}
        {isAdmin ? (
          <Link href="/target-lists/new" className="text-primary underline-offset-4 hover:underline">
            Create your first audience list
          </Link>
        ) : null}
        .
      </div>
    );
  }

  return (
    <>
      <DataTableSurface variant="delivery">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Filter summary</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Campaigns</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={`/target-lists/${r.id}`}
                      className="w-fit text-foreground hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.explicitMemberCount > 0 ? (
                      <span className="text-xs font-normal text-muted-foreground tabular-nums">
                        {r.explicitMemberCount} explicit
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.filterSummary}</TableCell>
                <TableCell className="text-right tabular-nums">{r.qualifyingCount}</TableCell>
                <TableCell className="text-right tabular-nums">{r.campaignsUsing}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.updatedAt).toLocaleString('en-US', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/35 p-1 shadow-xs motion-safe:transition-[background-color] hover:bg-muted/50"
                    role="group"
                    aria-label={`Actions for ${r.name}`}
                  >
                    <Button variant="ghost" size="icon-lg" className="size-10 shrink-0 rounded-md" asChild>
                      <Link
                        href={`/target-lists/${r.id}`}
                        title="View members"
                        aria-label={`View members — ${r.name}`}
                      >
                        <IconEye className="size-4" aria-hidden />
                      </Link>
                    </Button>
                    {isAdmin ? (
                      <>
                        <span
                          className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:block"
                          aria-hidden
                        />
                        <Button variant="ghost" size="icon-lg" className="size-10 shrink-0 rounded-md" asChild>
                          <Link
                            href={`/target-lists/${r.id}/edit`}
                            title="Edit list"
                            aria-label={`Edit list — ${r.name}`}
                          >
                            <IconPencil className="size-4" aria-hidden />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-lg"
                          className="size-10 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive focus-visible:text-destructive"
                          title="Delete list"
                          aria-label={`Delete list — ${r.name}`}
                          onClick={() => setDeleteId(r.id)}
                        >
                          <IconTrash className="size-4" aria-hidden />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      </DataTableSurface>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete audience list?</AlertDialogTitle>
            <AlertDialogDescription>
              {rowToDelete ? (
                <>
                  Delete &quot;{rowToDelete.name}&quot;? {rowToDelete.campaignsUsing} campaign
                  {rowToDelete.campaignsUsing === 1 ? '' : 's'} currently reference this list; their
                  audience list will be cleared (the campaign&apos;s other rules still apply).
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(ev) => {
                ev.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
