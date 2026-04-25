import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { PlatformForm } from '../platform-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New site or app',
};

export default async function NewPlatformPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/platforms');
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New site or app</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Register a website or app so campaigns can target it.
        </p>
      </header>
      <Card className="w-full overflow-hidden">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-lg">Site or app details</CardTitle>
          <CardDescription>Add a new place where your ads can appear.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PlatformForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
