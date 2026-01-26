import { notFound } from 'next/navigation';
import { database as db } from '@/db';
import { ads, platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AdForm } from '../../ad-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAdPage({ params }: PageProps) {
  const { id } = await params;

  const [ad] = await db
    .select()
    .from(ads)
    .where(eq(ads.id, id))
    .limit(1);

  if (!ad) {
    notFound();
  }

  const allPlatforms = await db.select().from(platforms).orderBy(platforms.name);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Ad</h1>
        <p className="text-muted-foreground">Update ad details</p>
      </div>
      <div className="max-w-2xl">
        <AdForm ad={ad} platforms={allPlatforms} mode="edit" />
      </div>
    </div>
  );
}
