'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IconCircleCheck,
  IconLoader2,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
  IconDevices,
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
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { adminPanelCardClassName, dataTableHeadMutedClassName } from '@/lib/admin-ui';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { authClient } from '@/lib/auth-client';
import { parseUserAgent } from '@/lib/ua-parser';
import { cn } from '@/lib/utils';

type SessionRow = {
  id: string;
  token: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function formatWhen(value: string | Date) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function sessionErrorMessage(message: string | undefined) {
  if (!message) return 'Something went wrong.';
  if (/not fresh|SESSION_EXPIRED|expired/i.test(message)) {
    return `${message} Try signing out and signing in again, then retry.`;
  }
  return message;
}

function SessionsTableSkeleton() {
  return (
    <div className="space-y-3 border-t border-border px-4 py-4 sm:px-6" aria-hidden>
      <div className="flex gap-4">
        <Skeleton className="h-4 flex-1 max-w-[120px] motion-reduce:animate-none" />
        <Skeleton className="hidden h-4 flex-1 max-w-[80px] sm:block motion-reduce:animate-none" />
        <Skeleton className="h-4 flex-1 max-w-[140px] motion-reduce:animate-none" />
        <Skeleton className="h-4 w-10 shrink-0 motion-reduce:animate-none" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 border-t border-border pt-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 max-w-[240px] motion-reduce:animate-none" />
            <Skeleton className="h-3 max-w-[160px] motion-reduce:animate-none md:hidden" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block motion-reduce:animate-none" />
          <Skeleton className="h-4 w-28 shrink-0 motion-reduce:animate-none" />
          <Skeleton className="size-9 shrink-0 rounded-md motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

export function AccountSessionsCard() {
  const { data: sessionData, isPending: sessionPending } = authClient.useSession();
  const currentSessionId = sessionData?.session?.id ?? null;

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeToken, setRevokeToken] = useState<string | null>(null);
  const [revokeOtherOpen, setRevokeOtherOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authClient.listSessions();
      if (res.error) {
        toast.error(sessionErrorMessage(res.error.message));
        setSessions([]);
        return;
      }
      const list = (res.data ?? []) as SessionRow[];
      setSessions(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load sessions.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevokeOne = async () => {
    if (!revokeToken) return;
    setActionLoading(true);
    try {
      const res = await authClient.revokeSession({ token: revokeToken });
      if (res.error) {
        toast.error(sessionErrorMessage(res.error.message));
        return;
      }
      toast.success('Session signed out.');
      const wasCurrent =
        sessions.find((s) => s.token === revokeToken)?.id === currentSessionId;
      setRevokeToken(null);
      if (wasCurrent) {
        await authClient.signOut();
        window.location.href = '/login';
        return;
      }
      await loadSessions();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeOther = async () => {
    setActionLoading(true);
    try {
      const res = await authClient.revokeOtherSessions();
      if (res.error) {
        toast.error(sessionErrorMessage(res.error.message));
        return;
      }
      toast.success('Signed out of other devices.');
      setRevokeOtherOpen(false);
      await loadSessions();
    } finally {
      setActionLoading(false);
    }
  };

  const otherCount = currentSessionId
    ? sessions.filter((s) => s.id !== currentSessionId).length
    : sessions.length;

  const busy = loading || sessionPending;

  return (
    <>
      <Card className={cn('gap-0 py-0', adminPanelCardClassName)}>
        <CardHeader className="border-0 px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <IconDevices className="size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-lg">Active sessions</CardTitle>
              <CardDescription className="text-pretty text-sm leading-snug">
                Browsers and devices using your account. Revoke any you do not recognize.
              </CardDescription>
            </div>
          </div>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={busy || actionLoading}
              onClick={() => void loadSessions()}
              aria-label="Refresh session list"
            >
              <IconRefresh
                className={cn(
                  'size-4 shrink-0',
                  busy && 'motion-safe:animate-spin motion-reduce:animate-none'
                )}
                aria-hidden
              />
              Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || actionLoading || otherCount === 0}
              onClick={() => setRevokeOtherOpen(true)}
            >
              Sign out others
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 pb-5 pt-0 sm:pb-6">
          {busy ? (
            <SessionsTableSkeleton />
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-t border-border px-4 py-8 text-center sm:px-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <IconShieldCheck className="size-5" aria-hidden />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-medium text-foreground">No active sessions</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Try refresh, or sign in again if the list should not be empty.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSessions()}>
                Try again
              </Button>
            </div>
          ) : (
            <DataTableSurface className="min-w-0 rounded-none border-x-0 border-b-0 border-t shadow-none">
              <div className="w-full overflow-x-auto">
                <Table className="w-full table-auto">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      className={cn(
                        dataTableHeadMutedClassName,
                        'h-10 w-[min(40%,280px)] px-4 py-2 sm:px-6',
                      )}
                    >
                      Device
                    </TableHead>
                    <TableHead
                      className={cn(
                        dataTableHeadMutedClassName,
                        'hidden h-10 px-4 py-2 sm:table-cell',
                      )}
                    >
                      IP address
                    </TableHead>
                    <TableHead
                      className={cn(dataTableHeadMutedClassName, 'h-10 whitespace-nowrap px-4 py-2')}
                    >
                      Started
                    </TableHead>
                    <TableHead
                      className={cn(
                        dataTableHeadMutedClassName,
                        'hidden h-10 whitespace-nowrap px-4 py-2 md:table-cell',
                      )}
                    >
                      Expires
                    </TableHead>
                    <TableHead
                      className={cn(
                        dataTableHeadMutedClassName,
                        'h-10 w-14 px-4 py-2 text-right sm:px-6',
                      )}
                    >
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((row) => {
                    const { browser, os } = parseUserAgent(row.userAgent);
                    const isCurrent = currentSessionId !== null && row.id === currentSessionId;
                    return (
                      <TableRow
                        key={row.id}
                        aria-current={isCurrent ? 'true' : undefined}
                        className={cn(
                          isCurrent &&
                            'bg-muted/50 hover:bg-muted/60 dark:bg-muted/30 dark:hover:bg-muted/45'
                        )}
                      >
                        <TableCell className="align-top px-4 py-3 sm:px-6">
                          <div className="space-y-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium leading-snug text-foreground">
                                {browser}
                                <span className="font-normal text-muted-foreground"> · </span>
                                {os}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="outline"
                                  className="border-primary/40 bg-primary/15 font-normal text-primary dark:border-primary/50 dark:bg-primary/25 dark:text-primary-foreground"
                                >
                                  <IconCircleCheck stroke={2} aria-hidden />
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground md:hidden">
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
                        <TableCell className="align-top px-4 py-3 text-right sm:px-6">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 text-muted-foreground hover:text-destructive"
                                disabled={actionLoading}
                                onClick={() => setRevokeToken(row.token)}
                              >
                                <IconTrash className="size-4" aria-hidden />
                                <span className="sr-only">
                                  {isCurrent ? 'Sign out this device' : 'Revoke this session'}
                                </span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {isCurrent ? 'Sign out this device' : 'Sign out this session'}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </DataTableSurface>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokeToken} onOpenChange={(open) => !open && setRevokeToken(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out this session?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              That device will be logged out immediately. If this is the browser you are using now,
              you will need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevokeOne();
              }}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <>
                  <IconLoader2 className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden />
                  Signing out…
                </>
              ) : (
                'Sign out'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeOtherOpen} onOpenChange={setRevokeOtherOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out other devices?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              All sessions except this browser will end. Use this if you lost a device or see
              unfamiliar activity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevokeOther();
              }}
              disabled={actionLoading}
              className="inline-flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <IconLoader2 className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden />
                  Working…
                </>
              ) : (
                'Sign out others'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
