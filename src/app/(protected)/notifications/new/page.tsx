import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { NotificationForm } from '../notification-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New notification',
};

export default async function NewNotificationPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Notification</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Define the notification content and optional call-to-action link.
        </p>
      </header>
      <Card className="w-full overflow-hidden">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-lg">Notification details</CardTitle>
          <CardDescription>Create a new global notification</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <NotificationForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
