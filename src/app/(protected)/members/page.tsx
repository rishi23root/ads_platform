import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { user } from '@/db/schema';
import { CreateUserDialog } from '@/components/create-user-dialog';
import { MembersTable } from '@/components/members-table';
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
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-muted-foreground">Manage dashboard members and roles</p>
        </div>
        <CreateUserDialog />
      </div>

      <MembersTable members={members} currentUserId={sessionWithRole.user.id} />
    </div>
  );
}
