'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IconDevices,
  IconLoader2,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { parseUserAgent } from '@/lib/ua-parser';

type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  active: boolean;
};

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

interface AdminEndUserSessionsCardProps {
  userId: string;
  /** When false, hide revoke (non-admin). Default true */
  allowRevoke?: boolean;
}

export function AdminEndUserSessionsCard({ userId, allowRevoke = true }: AdminEndUserSessionsCardProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/end-users/${userId}/sessions`);
      if (!res.ok) {
        toast.error('Could not load extension session');
        setSessions([]);
        return;
      }
      const data = (await res.json()) as { sessions?: SessionRow[] };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      toast.error('Could not load extension session');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revokeOne = async () => {
    if (!revokeId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/end-users/${userId}/sessions/${revokeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Could not revoke session');
        return;
      }
      toast.success('Session revoked');
      setRevokeId(null);
      await loadSessions();
    } finally {
      setActionLoading(false);
    }
  };

  const activeCount = sessions.filter((s) => s.active).length;
  const summary =
    activeCount > 0
      ? 'Active session'
      : sessions.length > 0
        ? 'No active session (expired)'
        : 'No session yet';

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-0 pb-3 pt-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <IconDevices className="size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-lg">Extension session</CardTitle>
              <CardDescription className="text-pretty text-sm leading-snug">
                Current bearer token for this user. Only one session is kept at a time; revoking ends
                their access until they sign in or provision again.
              </CardDescription>
            </div>
          </div>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading || actionLoading}
              onClick={() => void loadSessions()}
            >
              <IconRefresh
                className={`size-4 shrink-0 ${loading ? 'motion-safe:animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden
              />
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 pb-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center border-t border-border py-12 text-muted-foreground">
              <IconLoader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : sessions.length === 0 ? (
            <div className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
              No session yet. Sessions appear after the extension calls provision or login.
            </div>
          ) : (
            <div className="border-t border-border">
              <p className="px-6 py-2 text-xs text-muted-foreground">{summary}</p>
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-10 w-[min(40%,280px)] px-6 py-2 font-medium">
                      Device
                    </TableHead>
                    <TableHead className="hidden h-10 px-4 py-2 font-medium sm:table-cell">
                      IP
                    </TableHead>
                    <TableHead className="h-10 whitespace-nowrap px-4 py-2 font-medium">
                      Started
                    </TableHead>
                    <TableHead className="hidden h-10 whitespace-nowrap px-4 py-2 font-medium md:table-cell">
                      Expires
                    </TableHead>
                    {allowRevoke ? (
                      <TableHead className="h-10 w-14 px-6 py-2 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((row) => {
                    const { browser, os } = parseUserAgent(row.userAgent);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="align-top px-6 py-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium leading-snug text-foreground">
                                {browser}
                                <span className="font-normal text-muted-foreground"> · </span>
                                {os}
                              </span>
                              {row.active ? (
                                <Badge variant="outline" className="font-normal">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="font-normal">
                                  Expired
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Expires {formatWhen(row.expiresAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden align-top px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                          <span className="line-clamp-2 break-all" title={row.ipAddress ?? undefined}>
                            {row.ipAddress?.trim() || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatWhen(row.createdAt)}
                        </TableCell>
                        <TableCell className="hidden align-top px-4 py-3 text-sm tabular-nums text-muted-foreground whitespace-nowrap md:table-cell">
                          {formatWhen(row.expiresAt)}
                        </TableCell>
                        {allowRevoke ? (
                          <TableCell className="align-top px-6 py-3 text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-muted-foreground hover:text-destructive"
                                  disabled={actionLoading || !row.active}
                                  onClick={() => setRevokeId(row.id)}
                                >
                                  <IconTrash className="size-4" />
                                  <span className="sr-only">Revoke session</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {row.active ? 'Revoke session' : 'Session already expired'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={allowRevoke && !!revokeId}
        onOpenChange={(open) => !open && setRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The user will need to sign in or provision again from the extension.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void revokeOne();
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Working…' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
