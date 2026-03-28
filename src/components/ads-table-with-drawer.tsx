'use client';

import { useState, useEffect } from 'react';
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
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { AdEditDrawer } from '@/components/ad-edit-drawer';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Ad } from '@/db/schema';

export type AdListRow = Ad & { linkedCampaignCount: number };

interface AdsTableWithDrawerProps {
  ads: AdListRow[];
  initialEditId?: string | null;
}

export function AdsTableWithDrawer({ ads, initialEditId }: AdsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [selectedAd, setSelectedAd] = useState<AdListRow | null>(null);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const ad = ads.find((a) => a.id === initialEditId);
      queueMicrotask(() => {
        if (ad) {
          setSelectedAd(ad);
          setSelectedAdId(null);
        } else {
          setSelectedAd(null);
          setSelectedAdId(initialEditId);
        }
        setDrawerMode('edit');
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, ads]);

  const openDrawer = (ad: AdListRow, mode: 'view' | 'edit') => {
    setSelectedAd(ad);
    setSelectedAdId(null);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const openRow = (ad: AdListRow) => openDrawer(ad, 'view');

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
            <p className="text-sm text-muted-foreground">Manage your ad content library</p>
          </div>
          <Button asChild className="shrink-0 self-start sm:self-auto">
            <Link href="/ads/new">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Ad
            </Link>
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/80 bg-card/30 shadow-sm">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Name</TableHead>
                <TableHead className="h-12 w-[35%] min-w-0 px-4 py-3 font-medium">
                  Target URL
                </TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 text-center font-medium tabular-nums">
                  Campaigns
                </TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Created</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No ads found. Create your first ad.
                  </TableCell>
                </TableRow>
              ) : (
                ads.map((ad) => (
                  <TableRow
                    key={ad.id}
                    className="min-h-[52px] cursor-pointer transition-colors hover:bg-muted/40"
                    tabIndex={0}
                    onClick={() => openRow(ad)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRow(ad);
                      }
                    }}
                  >
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-medium">{ad.name}</TableCell>
                    <TableCell className="max-w-xs min-w-0 overflow-hidden px-4 py-3 align-middle whitespace-normal">
                      {ad.targetUrl ? (
                        <a
                          href={ad.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={ad.targetUrl}
                          className="block max-w-full truncate text-primary underline-offset-4 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ad.targetUrl}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle tabular-nums">
                      <div className="flex justify-center">
                        {ad.linkedCampaignCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="min-w-7 justify-center px-2.5 py-0.5 tabular-nums font-medium"
                          >
                            {ad.linkedCampaignCount}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="min-w-0 px-4 py-3 align-middle text-sm tabular-nums text-muted-foreground"
                      title="UTC"
                    >
                      {formatDateTimeUtcEnGb(ad.createdAt)}
                    </TableCell>
                    <TableCell
                      className="min-w-0 px-4 py-3 text-right align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={`Edit ${ad.name}`}
                          onClick={() => openDrawer(ad, 'edit')}
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton name={ad.name} entityType="ad" apiPath={`/api/ads/${ad.id}`} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AdEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ad={selectedAd}
        adId={selectedAdId ?? undefined}
        initialMode={drawerMode}
      />
    </>
  );
}
