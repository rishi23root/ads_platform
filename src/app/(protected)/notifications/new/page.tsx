import { NotificationForm } from '../notification-form';

export default async function NewNotificationPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Notification</h1>
        <p className="text-muted-foreground">Create a new global notification</p>
      </div>
      <div className="max-w-2xl">
        <NotificationForm mode="create" />
      </div>
    </div>
  );
}
