import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { NotificationForm } from '../notification-form';

export default async function NewNotificationPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">New Notification</CardTitle>
          <CardDescription>Create a new global notification</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
