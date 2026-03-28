import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { RedirectForm } from '../redirect-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New redirect',
};

export default async function NewRedirectPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Redirect</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Configure domain matching rules and the destination URL.
        </p>
      </header>
      <Card className="w-full overflow-hidden">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-lg">Redirect details</CardTitle>
          <CardDescription>Define a source domain and where users should be sent</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RedirectForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
