import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { getSessionWithRole } from '@/lib/dal';
import { TargetListForm } from '../target-list-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New audience list',
};

export const dynamic = 'force-dynamic';

export default async function NewTargetListPage() {
  const s = await getSessionWithRole();
  if (!s) redirect('/login');
  if (s.role !== 'admin') redirect('/target-lists');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Link
        href="/target-lists"
        className="inline-flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
      >
        <IconArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to audience lists
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">New audience list</h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Combine segment filters and/or specific app users. Users qualify if they match the
          filter <span className="text-foreground/90">or</span> appear in the member list. Campaigns
          attach this list under Audience.
        </p>
      </header>
      <TargetListForm mode="create" />
    </div>
  );
}
