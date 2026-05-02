import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { RedirectForm } from '../redirect-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New URL redirect',
};

export default async function NewRedirectPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/redirects');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New URL redirect</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Send visitors from one link to another. Set which link to match and where to send them.
        </p>
      </header>
      <Card className="w-full overflow-hidden">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-lg">Redirect details</CardTitle>
          <CardDescription>Choose a source link and the destination URL.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RedirectForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
