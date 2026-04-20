import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { eq } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
import { database as db } from '@/db';
import { targetLists } from '@/db/schema';
import { TargetListForm } from '../../target-list-form';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const s = await getSessionWithRole();
  if (!s || s.role !== 'admin') return { title: 'Edit target list' };
  const { id } = await params;
  const [row] = await db.select({ name: targetLists.name }).from(targetLists).where(eq(targetLists.id, id)).limit(1);
  return { title: row ? `Edit · ${row.name}` : 'Edit target list' };
}

export default async function EditTargetListPage({ params }: PageProps) {
  const s = await getSessionWithRole();
  if (!s) redirect('/login');
  if (s.role !== 'admin') redirect('/target-lists');

  const { id } = await params;
  const [row] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
  if (!row) notFound();

  const initial = {
    id: row.id,
    name: row.name,
    filterJson: row.filterJson,
    memberIds: [...(row.memberIds ?? [])],
    excludedIds: [...(row.excludedIds ?? [])],
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/target-lists"
          className="inline-flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
        >
          <IconArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Target lists
        </Link>
        <span className="hidden text-muted-foreground sm:inline" aria-hidden>
          ·
        </span>
        <Link
          href={`/target-lists/${initial.id}`}
          className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
        >
          View members
        </Link>
      </div>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Edit target list</h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Update filters and members. Saving publishes updates to redirect campaigns that use this
          list.
        </p>
      </header>
      <TargetListForm mode="edit" initial={initial} />
    </div>
  );
}
