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
import { PageHeader } from '@/components/page-header';
import { PlatformEditDrawer } from '@/components/platform-edit-drawer';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Platform } from '@/db/schema';

export type PlatformListRow = Platform & { linkedCampaignCount: number };

interface PlatformsTableWithDrawerProps {
  platforms: PlatformListRow[];
  initialEditId?: string | null;
  isAdmin: boolean;
}

export function PlatformsTableWithDrawer({
  platforms,
  initialEditId,
  isAdmin,
}: PlatformsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformListRow | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const platform = platforms.find((p) => p.id === initialEditId);
      queueMicrotask(() => {
        if (platform) {
          setSelectedPlatform(platform);
          setSelectedPlatformId(null);
        } else {
          setSelectedPlatform(null);
          setSelectedPlatformId(initialEditId);
        }
        setDrawerMode(isAdmin ? 'edit' : 'view');
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, platforms, isAdmin]);

  const openDrawer = (platform: PlatformListRow, mode: 'view' | 'edit') => {
    setSelectedPlatform(platform);
    setSelectedPlatformId(null);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const openRow = (platform: PlatformListRow) => {
    openDrawer(platform, 'view');
  };

  const colCount = isAdmin ? 5 : 4;

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          title="Sites & apps"
          description="Websites and apps where your ads can appear."
          actions={
            isAdmin ? (
              <Button asChild className="shrink-0 self-start sm:self-auto">
                <Link href="/platforms/new">
                  <IconPlus className="mr-2 h-4 w-4" />
                  New site or app
                </Link>
              </Button>
            ) : undefined
          }
        />

        <DataTableSurface>
          <Table className="w-full min-w-[44rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[10rem] px-4 py-3 text-left align-middle font-medium">
                  Name
                </TableHead>
                <TableHead className="min-w-[12rem] px-4 py-3 text-left align-middle font-medium">
                  Domain
                </TableHead>
                <TableHead className="w-24 px-4 py-3 text-center align-middle font-medium tabular-nums">
                  Campaigns
                </TableHead>
                <TableHead className="min-w-[12rem] whitespace-nowrap px-4 py-3 text-left align-middle font-medium">
                  Created
                </TableHead>
                {isAdmin ? (
                  <TableHead className="w-28 min-w-[7rem] whitespace-nowrap px-3 py-3 text-right align-middle font-medium">
                    Actions
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.length === 0 ? (
                <EmptyTableRow
                  colSpan={colCount}
                  title="No sites or apps yet"
                  description={
                    isAdmin
                      ? 'Register the websites and apps where your campaigns can run.'
                      : 'Your team has not registered any sites or apps yet.'
                  }
                  action={
                    isAdmin ? (
                      <Button asChild size="sm">
                        <Link href="/platforms/new">
                          <IconPlus className="mr-2 h-4 w-4" />
                          Add your first site or app
                        </Link>
                      </Button>
                    ) : null
                  }
                />
              ) : (
                platforms.map((platform) => (
                  <TableRow
                    key={platform.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40 min-h-[52px]"
                    tabIndex={0}
                    onClick={() => openRow(platform)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRow(platform);
                      }
                    }}
                  >
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-medium">{platform.name}</TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle">
                      {platform.domain ? (
                        <span className="inline-flex max-w-full items-center rounded-md border border-border/80 bg-muted/35 px-2.5 py-1 font-mono text-xs text-foreground">
                          <span className="truncate">{platform.domain}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle tabular-nums">
                      <div className="flex justify-center">
                        {platform.linkedCampaignCount > 0 ? (
                          <Badge variant="secondary" className="min-w-7 justify-center px-2.5 py-0.5 tabular-nums font-medium">
                            {platform.linkedCampaignCount}
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
                      {formatDateTimeUtcEnGb(platform.createdAt)}
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
                            aria-label={`Edit ${platform.name}`}
                            onClick={() => openDrawer(platform, 'edit')}
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            name={platform.name}
                            entityType="platform"
                            apiPath={`/api/platforms/${platform.id}`}
                            disabled={platform.linkedCampaignCount > 0}
                            disabledReason={
                              platform.linkedCampaignCount > 0
                                ? `Targeted by ${platform.linkedCampaignCount} campaign(s). Unlink or remove those campaigns first.`
                                : undefined
                            }
                            linkedHelp={
                              platform.linkedCampaignCount > 0
                                ? { type: 'platform', entityId: platform.id }
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

      <PlatformEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        platform={selectedPlatform}
        platformId={selectedPlatformId ?? undefined}
        initialMode={drawerMode}
        showEditAction={isAdmin}
      />
    </>
  );
}
