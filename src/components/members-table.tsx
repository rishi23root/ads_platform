'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { Badge } from '@/components/ui/badge';
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
import { IconPencil, IconTrash, IconLoader2 } from '@tabler/icons-react';
import { EditUserDrawer } from '@/components/edit-user-drawer';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

interface MemberRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  banned?: boolean;
  createdAt: Date;
}

interface MembersTableProps {
  members: MemberRow[];
  currentUserId?: string;
}

export function MembersTable({ members, currentUserId }: MembersTableProps) {
  const router = useRouter();
  const [editingUser, setEditingUser] = useState<MemberRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<MemberRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openEdit = (row: MemberRow) => {
    setEditingUser(row);
    setEditOpen(true);
  };

  const openDelete = (row: MemberRow) => {
    setDeletingUser(row);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const result = await authClient.admin.removeUser({ userId: deletingUser.id });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success('Member removed');
      setDeleteOpen(false);
      setDeletingUser(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DataTableSurface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Banned</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <EmptyTableRow
                colSpan={6}
                title="No members yet"
                description="Invite teammates to give them access to this admin dashboard."
              />
            ) : (
              members.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(u)}
                >
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.banned ? (
                      <Badge variant="destructive">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(u.createdAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit member">
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(u)}
                        title="Remove member"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
        </TableBody>
      </Table>
      </DataTableSurface>
      <EditUserDrawer user={editingUser} open={editOpen} onOpenChange={setEditOpen} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingUser?.id === currentUserId ? (
                <>
                  You are about to delete your own account ({deletingUser?.email}). You will be signed out immediately and will need to create a new account to access the dashboard again. This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete {deletingUser?.email}? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
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
    </>
  );
}
