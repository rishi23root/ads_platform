import { getSessionWithRole } from '@/lib/dal';
import { redirect, notFound } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CampaignDashboard } from '@/components/dashboard/CampaignDashboard';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');

  const { id } = await params;
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) notFound();

  const isAdmin = sessionWithRole.role === 'admin';

  return <CampaignDashboard campaign={c} isAdmin={isAdmin} />;
}
