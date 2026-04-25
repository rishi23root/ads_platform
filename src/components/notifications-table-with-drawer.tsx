'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { PageHeader } from '@/components/page-header';
import { NotificationEditDrawer } from '@/components/notification-edit-drawer';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Notification } from '@/db/schema';

export type NotificationListRow = Notification & { linkedCampaignCount: number };

interface NotificationsTableWithDrawerProps {
  notifications: NotificationListRow[];
  initialEditId?: string | null;
  isAdmin: boolean;
}

export function NotificationsTableWithDrawer({
  notifications,
  initialEditId,
  isAdmin,
}: NotificationsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [selectedNotification, setSelectedNotification] = useState<NotificationListRow | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const notification = notifications.find((n) => n.id === initialEditId);
      queueMicrotask(() => {
        if (notification) {
          setSelectedNotification(notification);
          setSelectedNotificationId(null);
        } else {
          setSelectedNotification(null);
          setSelectedNotificationId(initialEditId);
        }
        setDrawerMode(isAdmin ? 'edit' : 'view');
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, notifications, isAdmin]);

  const openDrawer = (notification: NotificationListRow, mode: 'view' | 'edit') => {
    setSelectedNotification(notification);
    setSelectedNotificationId(null);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const openRow = (notification: NotificationListRow) => openDrawer(notification, 'view');
  const colCount = isAdmin ? 6 : 5;

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          title="Notifications"
          description="In-app messages your campaigns can deliver to users."
          actions={
            isAdmin ? (
              <Button asChild className="shrink-0 self-start sm:self-auto">
                <Link href="/notifications/new">
                  <IconPlus className="mr-2 h-4 w-4" />
                  New notification
                </Link>
              </Button>
            ) : undefined
          }
        />

        <DataTableSurface>
          <Table className="w-full min-w-[56rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 min-w-[8rem] px-4 py-3 font-medium">Title</TableHead>
                <TableHead className="h-12 min-w-[12rem] px-4 py-3 font-medium">Message</TableHead>
                <TableHead className="h-12 min-w-[10rem] px-4 py-3 font-medium">CTA Link</TableHead>
                <TableHead className="h-12 w-24 px-4 py-3 text-center font-medium tabular-nums">
                  Campaigns
                </TableHead>
                <TableHead className="h-12 min-w-[12rem] whitespace-nowrap px-4 py-3 font-medium">
                  Created
                </TableHead>
                {isAdmin ? (
                  <TableHead className="h-12 w-28 min-w-[7rem] whitespace-nowrap px-3 py-3 text-right font-medium">
                    Actions
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <EmptyTableRow
                  colSpan={colCount}
                  title="No notifications yet"
                  description={
                    isAdmin
                      ? 'In-app messages your campaigns can deliver to users.'
                      : 'Your team has not created any notifications yet.'
                  }
                  action={
                    isAdmin ? (
                      <Button asChild size="sm">
                        <Link href="/notifications/new">
                          <IconPlus className="mr-2 h-4 w-4" />
                          Create your first notification
                        </Link>
                      </Button>
                    ) : null
                  }
                />
              ) : (
                notifications.map((notification) => (
                  <TableRow
                    key={notification.id}
                    className="min-h-[52px] cursor-pointer transition-colors hover:bg-muted/40"
                    tabIndex={0}
                    onClick={() => openRow(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRow(notification);
                      }
                    }}
                  >
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block max-w-full cursor-pointer truncate align-middle">
                            {notification.title}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm text-balance">
                          {notification.title}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="max-w-xs min-w-0 overflow-hidden px-4 py-3 align-middle">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block max-w-full cursor-pointer truncate align-middle">
                            {notification.message}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm text-balance">
                          {notification.message}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="max-w-[200px] min-w-0 overflow-hidden px-4 py-3 align-middle">
                      {notification.ctaLink ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={notification.ctaLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block max-w-full cursor-pointer truncate text-primary underline-offset-4 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {notification.ctaLink}
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm break-all">
                            {notification.ctaLink}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle tabular-nums">
                      <div className="flex justify-center">
                        {notification.linkedCampaignCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="min-w-7 justify-center px-2.5 py-0.5 tabular-nums font-medium"
                          >
                            {notification.linkedCampaignCount}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="min-w-[12rem] whitespace-nowrap px-4 py-3 align-middle text-sm tabular-nums text-muted-foreground"
                      title="UTC"
                    >
                      {formatDateTimeUtcEnGb(notification.createdAt)}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell
                        className="w-28 min-w-[7rem] whitespace-nowrap px-3 py-3 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={`Edit ${notification.title}`}
                            onClick={() => openDrawer(notification, 'edit')}
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            name={notification.title}
                            entityType="notification"
                            apiPath={`/api/notifications/${notification.id}`}
                            disabled={notification.linkedCampaignCount > 0}
                            disabledReason={
                              notification.linkedCampaignCount > 0
                                ? `Used by ${notification.linkedCampaignCount} campaign(s). Unlink or remove those campaigns first.`
                                : undefined
                            }
                            linkedHelp={
                              notification.linkedCampaignCount > 0
                                ? { type: 'notification', entityId: notification.id }
                                : undefined
                            }
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableSurface>
      </div>

      <NotificationEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        notification={selectedNotification}
        notificationId={selectedNotificationId ?? undefined}
        initialMode={drawerMode}
        showEditAction={isAdmin}
      />
    </>
  );
}
