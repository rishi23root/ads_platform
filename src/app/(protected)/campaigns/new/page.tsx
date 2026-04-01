import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { CampaignForm } from '../campaign-form';
import { CampaignFormShell } from '../campaign-form-shell';
import { getCampaignFormOptionLists } from '../campaign-form-data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New campaign',
};

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/campaigns');

  const lists = await getCampaignFormOptionLists();

  return (
    <CampaignFormShell
      title="New campaign"
      description="Configure targeting, schedule, and delivery rules for a new campaign."
    >
      <CampaignForm {...lists} mode="create" isAdmin />
    </CampaignFormShell>
  );
}
