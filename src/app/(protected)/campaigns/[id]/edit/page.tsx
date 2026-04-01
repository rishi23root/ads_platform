import { getSessionWithRole } from '@/lib/dal';
import { redirect, notFound } from 'next/navigation';
import { CampaignForm } from '../../campaign-form';
import { CampaignFormShell } from '../../campaign-form-shell';
import {
  getCampaignFormOptionLists,
  getCampaignByIdOrUndefined,
  campaignRowToFormInitial,
} from '../../campaign-form-data';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole || sessionWithRole.role !== 'admin') {
    return { title: 'Edit campaign' };
  }

  const { id } = await params;
  const c = await getCampaignByIdOrUndefined(id);
  return { title: c ? `Edit · ${c.name}` : 'Edit campaign' };
}

export default async function EditCampaignPage({
  params,
}: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/campaigns');

  const { id } = await params;

  const [c, lists] = await Promise.all([getCampaignByIdOrUndefined(id), getCampaignFormOptionLists()]);
  if (!c) notFound();

  const campaign = campaignRowToFormInitial(c);

  return (
    <CampaignFormShell
      title="Edit campaign"
      description="Update targeting, schedule, and delivery rules for this campaign."
    >
      <CampaignForm campaign={campaign} {...lists} mode="edit" isAdmin />
    </CampaignFormShell>
  );
}
