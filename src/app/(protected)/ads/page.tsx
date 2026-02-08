import Link from 'next/link';
import { database as db } from '@/db';
import { ads, platforms, adPlatforms } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';

export const dynamic = 'force-dynamic';

const statusColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  scheduled: 'outline',
  expired: 'destructive',
};

export default async function AdsPage() {
  const allAds = await db.select().from(ads).orderBy(ads.createdAt);
  const adIds = allAds.map((a) => a.id);
  const links =
    adIds.length > 0
      ? await db
          .select({
            adId: adPlatforms.adId,
            platformName: platforms.name,
            platformDomain: platforms.domain,
          })
          .from(adPlatforms)
          .innerJoin(platforms, eq(adPlatforms.platformId, platforms.id))
          .where(inArray(adPlatforms.adId, adIds))
      : [];

  const platformsByAdId = links.reduce<
    Record<string, { name: string; domain: string }[]>
  >((acc, row) => {
    if (!acc[row.adId]) acc[row.adId] = [];
    acc[row.adId].push({ name: row.platformName, domain: row.platformDomain });
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ads</h1>
          <p className="text-muted-foreground">Manage your advertisements</p>
        </div>
        <Button asChild>
          <Link href="/ads/new">
            <IconPlus className="mr-2 h-4 w-4" />
            Add Ad
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target URL</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allAds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No ads found. Create your first ad.
                </TableCell>
              </TableRow>
            ) : (
              allAds.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell className="font-medium">{ad.name}</TableCell>
                  <TableCell>
                    {(() => {
                      const adPlatformList = platformsByAdId[ad.id] ?? [];
                      if (adPlatformList.length === 0) return '-';
                      return (
                        <span className="flex flex-wrap gap-1">
                          {adPlatformList.map((p) => (
                            <Badge
                              key={p.domain}
                              variant="outline"
                              className="font-normal"
                            >
                              {p.domain || p.name}
                            </Badge>
                          ))}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ad.startDate && ad.endDate ? (
                      <>
                        {new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}
                      </>
                    ) : ad.startDate ? (
                      <>Starts: {new Date(ad.startDate).toLocaleDateString()}</>
                    ) : ad.endDate ? (
                      <>Ends: {new Date(ad.endDate).toLocaleDateString()}</>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[ad.status] || 'secondary'}>
                      {ad.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {ad.targetUrl ? (
                      <a
                        href={ad.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {ad.targetUrl}
                      </a>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/ads/${ad.id}/edit`}>
                          <IconPencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteButton id={ad.id} name={ad.name} entityType="ad" apiPath={`/api/ads/${ad.id}`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
