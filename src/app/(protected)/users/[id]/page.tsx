import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AdminEndUserSessionsCard } from '@/components/admin-end-user-sessions-card';
import { EndUserAnalyticsSection } from '@/components/end-user-analytics-section';
import { getSessionWithRole } from '@/lib/dal';
import { isValidEndUserUuid } from '@/lib/end-user-id';

export const dynamic = 'force-dynamic';

/**
 * Extension user detail shell: activity analytics + sessions.
 * Merge with a full profile/payments client when that module exists in your tree.
 */
export default async function EndUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const { id } = await params;
  if (!isValidEndUserUuid(id)) redirect('/users');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/users">Back to users</Link>
        </Button>
      </div>
      <EndUserAnalyticsSection endUserId={id} />
      <AdminEndUserSessionsCard userId={id} />
    </div>
  );
}
