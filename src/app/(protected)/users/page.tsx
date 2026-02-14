import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { user } from '@/db/schema';
import { CreateUserDialog } from '@/components/create-user-dialog';
import { UsersTable } from '@/components/users-table';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const users = await db
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
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted-foreground">Manage dashboard users and roles</p>
        </div>
        <CreateUserDialog />
      </div>

      <UsersTable users={users} currentUserId={sessionWithRole.user.id} />
    </div>
  );
}
