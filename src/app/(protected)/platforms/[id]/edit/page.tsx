import { notFound } from 'next/navigation';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PlatformForm } from '../../platform-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPlatformPage({ params }: PageProps) {
  const { id } = await params;
  
  const [platform] = await db
    .select()
    .from(platforms)
    .where(eq(platforms.id, id))
    .limit(1);

  if (!platform) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Platform</h1>
        <p className="text-muted-foreground">Update platform details</p>
      </div>
      <div className="max-w-2xl">
        <PlatformForm platform={platform} mode="edit" />
      </div>
    </div>
  );
}
