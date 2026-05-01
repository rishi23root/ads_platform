import { getSessionWithRole } from '@/lib/dal';
import { PageHeader } from '@/components/page-header';
import { LiveSessionsPanel } from '@/components/live-sessions-panel';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

/** Canonical route for extension live SSE sessions; sidebar uses the short label "Live". */
export const metadata: Metadata = {
  title: 'Live sessions',
};

export const dynamic = 'force-dynamic';

export default async function DeliveryLivePage() {
  const session = await getSessionWithRole();
  if (!session) redirect('/login');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <LiveSessionsPanel>
        <PageHeader
          title="Live"
          description="Open extension connections."
          className="min-w-0 flex-1"
        />
      </LiveSessionsPanel>
    </div>
  );
}
