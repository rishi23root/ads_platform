import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { AdForm } from '../ad-form';

export default async function NewAdPage() {
  const allPlatforms = await db.select().from(platforms).orderBy(platforms.name);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Ad</h1>
        <p className="text-muted-foreground">Create a new advertisement</p>
      </div>
      <div className="max-w-2xl">
        <AdForm platforms={allPlatforms} mode="create" />
      </div>
    </div>
  );
}
