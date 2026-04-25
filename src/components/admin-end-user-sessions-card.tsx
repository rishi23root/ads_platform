'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { IconDevices, IconRefresh, IconTrash } from '@tabler/icons-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { DateDisplayToggleButton } from '@/components/date-display-toggle-button';
import { HumanReadableDate } from '@/components/human-readable-date';
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
import { dataTableHeadMutedClassName } from '@/lib/admin-ui';
import { cn } from '@/lib/utils';
import { parseUserAgent } from '@/lib/ua-parser';

type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  active: boolean;
};

export type AdminEndUserSessionsCardHandle = {
  refresh: () => Promise<void>;
};

export type AdminEndUserSessionsCardSessionStatus = {
  loading: boolean;
  busy: boolean;
};

interface AdminEndUserSessionsCardProps {
  userId: string;
  /** When false, hide revoke (non-admin). Default true */
  allowRevoke?: boolean;
  /** Pre-loaded sessions from a combined endpoint — skips the initial fetch. */
  initialSessions?: SessionRow[] | null;
  /**
   * Omit outer title/description; render toolbar + body only (for use inside a parent Card).
   */
  embedded?: boolean;
  /**
   * When embedded, omit inner toolbar so the parent can place controls in CardHeader.
   */
  suppressEmbeddedToolbar?: boolean;
  /** Fires when fetch/revoke busy state changes (for parent header controls). */
  onSessionStatusChange?: (status: AdminEndUserSessionsCardSessionStatus) => void;
}

export const AdminEndUserSessionsCard = forwardRef<
  AdminEndUserSessionsCardHandle,
  AdminEndUserSessionsCardProps
>(function AdminEndUserSessionsCard(
  {
    userId,
    allowRevoke = true,
    initialSessions,
    embedded = false,
    suppressEmbeddedToolbar = false,
    onSessionStatusChange,
  },
  ref,
) {
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions ?? []);
  const [loading, setLoading] = useState(initialSessions == null);
  const [actionLoading, setActionLoading] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const skipInitialLoad = useRef(initialSessions != null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/end-users/${userId}/sessions`);
      if (!res.ok) {
        toast.error('Could not load sign-in session');
        setSessions([]);
        return;
      }
      const data = (await res.json()) as { sessions?: SessionRow[] };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      toast.error('Could not load sign-in session');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => loadSessions(),
    }),
    [loadSessions],
  );

  useEffect(() => {
    onSessionStatusChange?.({ loading, busy: loading || actionLoading });
  }, [loading, actionLoading, onSessionStatusChange]);

  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      return;
    }
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

  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DateDisplayToggleButton />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={loading || actionLoading}
        onClick={() => void loadSessions()}
        aria-label="Refresh session"
        className="h-8 w-8"
      >
        <IconRefresh
          className={`h-4 w-4 shrink-0 ${loading ? 'motion-safe:animate-spin motion-reduce:animate-none' : ''}`}
          aria-hidden
        />
      </Button>
    </div>
  );

  const bodyScrollClass = embedded
    ? 'max-h-[min(28rem,52vh)] min-h-0 overflow-y-auto overflow-x-auto'
    : '';

  const bodyInner = loading ? (
    <div className={embedded ? 'space-y-2 py-1' : 'space-y-2 rounded-lg bg-muted/10 p-4'}>
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-md" />
    </div>
  ) : sessions.length === 0 ? (
    <div
      className={
        embedded
          ? 'py-8 text-center text-sm text-muted-foreground'
          : 'rounded-lg bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground'
      }
    >
      No session yet. A session appears after the user signs in from the extension.
    </div>
  ) : (
    <div className={`min-w-0 ${embedded ? bodyScrollClass : bodyScrollClass}`}>
      <div className="w-full overflow-x-auto">
        <Table className="w-full table-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className={cn(dataTableHeadMutedClassName, 'w-[min(40%,280px)]')}
              >
                Device
              </TableHead>
              <TableHead className={cn(dataTableHeadMutedClassName, 'hidden sm:table-cell')}>
                IP
              </TableHead>
              <TableHead className={cn(dataTableHeadMutedClassName, 'whitespace-nowrap')}>
                Started
              </TableHead>
              <TableHead
                className={cn(dataTableHeadMutedClassName, 'hidden whitespace-nowrap md:table-cell')}
              >
                Expires
              </TableHead>
              {allowRevoke ? (
                <TableHead
                  className={cn(dataTableHeadMutedClassName, 'w-14 text-right')}
                >
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
                  <TableCell className="align-top py-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-sm leading-snug text-foreground">
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
                        Expires <HumanReadableDate date={new Date(row.expiresAt)} dense />
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden align-top py-2 text-sm text-muted-foreground sm:table-cell">
                    <span className="line-clamp-2 break-all" title={row.ipAddress ?? undefined}>
                      {row.ipAddress?.trim() || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="align-top py-2 text-sm text-muted-foreground whitespace-nowrap min-w-0">
                    <HumanReadableDate date={new Date(row.createdAt)} dense />
                  </TableCell>
                  <TableCell className="hidden align-top py-2 text-sm text-muted-foreground whitespace-nowrap min-w-0 md:table-cell">
                    <HumanReadableDate date={new Date(row.expiresAt)} dense />
                  </TableCell>
                  {allowRevoke ? (
                    <TableCell className="align-top py-2 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={actionLoading || !row.active}
                            onClick={() => setRevokeId(row.id)}
                          >
                            <IconTrash className="h-4 w-4" />
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
    </div>
  );

  const showEmbeddedToolbar = embedded && !suppressEmbeddedToolbar;

  return (
    <>
      {embedded ? (
        showEmbeddedToolbar ? (
          <div className="flex flex-col gap-3">
            {toolbar}
            {bodyInner}
          </div>
        ) : (
          bodyInner
        )
      ) : (
        <section aria-label="Sign-in session for this app user" className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <IconDevices className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">
                  Sign-in session ({loading ? '…' : sessions.length.toLocaleString()})
                </span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                One active session at a time. Revoking ends access until the user signs in again.{' '}
                <span className="text-foreground/80">{summary}.</span>
              </p>
            </div>
            {toolbar}
          </div>
          {bodyInner}
        </section>
      )}

      <AlertDialog
        open={allowRevoke && !!revokeId}
        onOpenChange={(open) => !open && setRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The user will need to sign in again from the extension.
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
});
