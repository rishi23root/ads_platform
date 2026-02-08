import { notFound } from 'next/navigation';
import { database as db } from '@/db';
import { ads, platforms, adPlatforms } from '@/db/schema';
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

  const [allPlatforms, linkedPlatforms] = await Promise.all([
    db.select().from(platforms).orderBy(platforms.name),
    db.select({ platformId: adPlatforms.platformId }).from(adPlatforms).where(eq(adPlatforms.adId, id)),
  ]);

  const initialPlatformIds = linkedPlatforms.map((r) => r.platformId);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Ad</h1>
        <p className="text-muted-foreground">Update ad details</p>
      </div>
      <div className="max-w-2xl">
        <AdForm ad={ad} platforms={allPlatforms} initialPlatformIds={initialPlatformIds} mode="edit" />
      </div>
    </div>
  );
}
