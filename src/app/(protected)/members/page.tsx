import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { user } from '@/db/schema';
import { CreateUserDialog } from '@/components/create-user-dialog';
import { MembersTable } from '@/components/members-table';
import { PageHeader } from '@/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Members',
};

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const members = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(user.createdAt);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Members"
        description="People who can sign in to this admin dashboard and their roles."
        actions={<CreateUserDialog />}
      />

      <MembersTable members={members} currentUserId={sessionWithRole.user.id} />
    </div>
  );
}
