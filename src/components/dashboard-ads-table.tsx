import Link from 'next/link';
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
import { IconPencil } from '@tabler/icons-react';

interface DashboardAd {
  id: string;
  name: string;
  platform: string;
  platformDomain?: string | null;
  platformName?: string | null;
  platforms?: { name: string; domain: string }[];
  status: string;
  dateRange: string;
  createdAt: string;
}

interface DashboardAdsTableProps {
  data: DashboardAd[];
}

const statusColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  scheduled: 'outline',
  expired: 'destructive',
};

export function DashboardAdsTable({ data }: DashboardAdsTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No ads found. Create your first ad to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ad Name</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((ad) => (
            <TableRow key={ad.id}>
              <TableCell className="font-medium">{ad.name}</TableCell>
              <TableCell>
                {ad.platforms && ad.platforms.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {ad.platforms.map((p) => (
                      <Badge
                        key={p.domain}
                        variant="outline"
                        className="font-normal"
                      >
                        {p.domain || p.name}
                      </Badge>
                    ))}
                  </span>
                ) : ad.platformDomain ? (
                  <Badge variant="outline" className="font-normal">
                    {ad.platformDomain}
                  </Badge>
                ) : ad.platformName ? (
                  <Badge variant="secondary" className="font-normal">
                    {ad.platformName}
                  </Badge>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {ad.dateRange}
              </TableCell>
              <TableCell>
                <Badge variant={statusColors[ad.status] || 'secondary'}>
                  {ad.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {ad.createdAt}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/ads/${ad.id}/edit`}>
                    <IconPencil className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
