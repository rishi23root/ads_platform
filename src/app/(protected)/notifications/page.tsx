import Link from 'next/link';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
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
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';

export const dynamic = 'force-dynamic';

function getStatusBadge(startDate: Date, endDate: Date) {
  const now = new Date();
  if (now < startDate) {
    return { label: 'Scheduled', variant: 'outline' as const };
  }
  if (now > endDate) {
    return { label: 'Expired', variant: 'secondary' as const };
  }
  return { label: 'Active', variant: 'default' as const };
}

export default async function NotificationsPage() {
  // Fetch all notifications
  const allNotifications = await db
    .select()
    .from(notifications)
    .orderBy(notifications.createdAt);

  return (
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
              <TableHead>Date Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allNotifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No notifications found. Create your first notification.
                </TableCell>
              </TableRow>
            ) : (
              allNotifications.map((notification) => {
                const status = getStatusBadge(notification.startDate, notification.endDate);

                return (
                  <TableRow key={notification.id}>
                    <TableCell className="font-medium">{notification.title}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {notification.message}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{new Date(notification.startDate).toLocaleDateString()}</span>
                        <span className="text-muted-foreground">to</span>
                        <span>{new Date(notification.endDate).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/notifications/${notification.id}/edit`}>
                            <IconPencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteButton id={notification.id} name={notification.title} entityType="notification" apiPath={`/api/notifications/${notification.id}`} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
