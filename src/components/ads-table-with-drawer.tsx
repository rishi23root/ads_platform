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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { PageHeader } from '@/components/page-header';
import { AdEditDrawer } from '@/components/ad-edit-drawer';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Ad } from '@/db/schema';

export type AdListRow = Ad & { linkedCampaignCount: number };

/** Keeps list rows readable: data URIs only show the metadata prefix in the cell (full value in tooltip). */
function targetUrlCellLabel(url: string): string {
  const u = url.trim();
  if (u.startsWith('data:')) {
    const comma = u.indexOf(',');
    if (comma > 0) return `${u.slice(0, comma)},…`;
    return 'data:…';
  }
  return u;
}

interface AdsTableWithDrawerProps {
  ads: AdListRow[];
  initialEditId?: string | null;
  isAdmin: boolean;
}

export function AdsTableWithDrawer({ ads, initialEditId, isAdmin }: AdsTableWithDrawerProps) {
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
        setDrawerMode(isAdmin ? 'edit' : 'view');
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, ads, isAdmin]);

  const openDrawer = (ad: AdListRow, mode: 'view' | 'edit') => {
    setSelectedAd(ad);
    setSelectedAdId(null);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const openRow = (ad: AdListRow) => openDrawer(ad, 'view');
  const colCount = isAdmin ? 5 : 4;

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          title="Ads"
          description="Ad images and links your campaigns can show."
          actions={
            isAdmin ? (
              <Button asChild className="shrink-0 self-start sm:self-auto">
                <Link href="/ads/new">
                  <IconPlus className="mr-2 h-4 w-4" />
                  New ad
                </Link>
              </Button>
            ) : undefined
          }
        />

        <DataTableSurface>
          <Table className="w-full min-w-[52rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 min-w-[10rem] px-4 py-3 font-medium">Name</TableHead>
                <TableHead className="h-12 max-w-[14rem] min-w-0 px-4 py-3 font-medium">
                  Target URL
                </TableHead>
                <TableHead className="h-12 w-24 px-4 py-3 text-center font-medium tabular-nums">
                  Campaigns
                </TableHead>
                <TableHead className="h-12 min-w-[12rem] whitespace-nowrap px-4 py-3 font-medium">
                  Created
                </TableHead>
                {isAdmin ? (
                  <TableHead className="h-12 w-28 min-w-[7rem] whitespace-nowrap px-3 py-3 text-right font-medium">
                    Actions
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.length === 0 ? (
                <EmptyTableRow
                  colSpan={colCount}
                  title="No ads yet"
                  description={
                    isAdmin
                      ? 'Ads are the images or links your campaigns show to users.'
                      : 'Your team has not created any ads yet.'
                  }
                  action={
                    isAdmin ? (
                      <Button asChild size="sm">
                        <Link href="/ads/new">
                          <IconPlus className="mr-2 h-4 w-4" />
                          Create your first ad
                        </Link>
                      </Button>
                    ) : null
                  }
                />
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
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block max-w-full cursor-pointer truncate align-middle">
                            {ad.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm text-balance">
                          {ad.name}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="max-w-[14rem] min-w-0 overflow-hidden px-4 py-3 align-middle">
                      {ad.targetUrl ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={ad.targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block max-w-full cursor-pointer truncate font-mono text-xs leading-snug text-primary underline-offset-4 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {targetUrlCellLabel(ad.targetUrl)}
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-md break-all text-xs">
                            {ad.targetUrl}
                          </TooltipContent>
                        </Tooltip>
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
                      className="min-w-[12rem] whitespace-nowrap px-4 py-3 align-middle text-sm tabular-nums text-muted-foreground"
                      title="UTC"
                    >
                      {formatDateTimeUtcEnGb(ad.createdAt)}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell
                        className="w-28 min-w-[7rem] whitespace-nowrap px-3 py-3 text-right align-middle"
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
                          <DeleteButton
                            name={ad.name}
                            entityType="ad"
                            apiPath={`/api/ads/${ad.id}`}
                            disabled={ad.linkedCampaignCount > 0}
                            disabledReason={
                              ad.linkedCampaignCount > 0
                                ? `Used by ${ad.linkedCampaignCount} campaign(s). Unlink or remove those campaigns first.`
                                : undefined
                            }
                            linkedHelp={
                              ad.linkedCampaignCount > 0
                                ? { type: 'ad', entityId: ad.id }
                                : undefined
                            }
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableSurface>
      </div>

      <AdEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ad={selectedAd}
        adId={selectedAdId ?? undefined}
        initialMode={drawerMode}
        showEditAction={isAdmin}
      />
    </>
  );
}
