import Link from 'next/link';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
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

export default async function PlatformsPage() {
  const allPlatforms = await db.select().from(platforms).orderBy(platforms.createdAt);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Platforms</h1>
          <p className="text-muted-foreground">Manage your advertising platforms</p>
        </div>
        <Button asChild>
          <Link href="/platforms/new">
            <IconPlus className="mr-2 h-4 w-4" />
            Add Platform
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allPlatforms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No platforms found. Create your first platform.
                </TableCell>
              </TableRow>
            ) : (
              allPlatforms.map((platform) => (
                <TableRow key={platform.id}>
                  <TableCell className="font-medium">{platform.name}</TableCell>
                  <TableCell>
                    {platform.domain ? (
                      <Badge variant="outline" className="font-normal">
                        {platform.domain}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={platform.isActive ? 'default' : 'secondary'}>
                      {platform.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(platform.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/platforms/${platform.id}/edit`}>
                          <IconPencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteButton id={platform.id} name={platform.name} entityType="platform" apiPath={`/api/platforms/${platform.id}`} />
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
