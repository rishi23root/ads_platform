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
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { NotificationEditDrawer } from '@/components/notification-edit-drawer';
import type { Notification } from '@/db/schema';

interface NotificationsTableWithDrawerProps {
  notifications: Notification[];
  initialEditId?: string | null;
}

export function NotificationsTableWithDrawer({
  notifications,
  initialEditId,
}: NotificationsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
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
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, notifications]);

  const openDrawer = (notification: Notification) => {
    setSelectedNotification(notification);
    setSelectedNotificationId(null);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Notifications</h1>
            <p className="text-muted-foreground">Manage global system notifications</p>
          </div>
          <Button asChild>
            <Link href="/notifications/new">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Notification
            </Link>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>CTA Link</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No notifications found. Create your first notification.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => (
                  <TableRow
                    key={notification.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer(notification)}
                  >
                    <TableCell className="font-medium">{notification.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{notification.message}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {notification.ctaLink ? (
                        <a
                          href={notification.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {notification.ctaLink}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(notification);
                          }}
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          id={notification.id}
                          name={notification.title}
                          entityType="notification"
                          apiPath={`/api/notifications/${notification.id}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <NotificationEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        notification={selectedNotification}
        notificationId={selectedNotificationId ?? undefined}
      />
    </>
  );
}
