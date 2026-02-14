import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { AdForm } from '../ad-form';

export default async function NewAdPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">New Ad</CardTitle>
          <CardDescription>Create a new advertisement</CardDescription>
        </CardHeader>
        <CardContent>
          <AdForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
