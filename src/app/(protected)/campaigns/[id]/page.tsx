import { getSessionWithRole } from '@/lib/dal';
import { redirect, notFound } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CampaignDashboard } from '@/components/dashboard/CampaignDashboard';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) {
    return { title: 'Campaign' };
  }

  const { id } = await params;
  const [row] = await db
    .select({ name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  return { title: row?.name ?? 'Campaign' };
}

export default async function CampaignDetailPage({
  params,
}: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');

  const { id } = await params;
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) notFound();

  const isAdmin = sessionWithRole.role === 'admin';

  return <CampaignDashboard campaign={c} isAdmin={isAdmin} />;
}
