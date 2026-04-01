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
import { RedirectEditDrawer } from '@/components/redirect-edit-drawer';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Redirect } from '@/db/schema';

export type RedirectListRow = Redirect & { linkedCampaignCount: number };

interface RedirectsTableWithDrawerProps {
  redirects: RedirectListRow[];
  initialEditId?: string | null;
  isAdmin: boolean;
}

export function RedirectsTableWithDrawer({
  redirects: rows,
  initialEditId,
  isAdmin,
}: RedirectsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [selected, setSelected] = useState<RedirectListRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const row = rows.find((r) => r.id === initialEditId);
      queueMicrotask(() => {
        if (row) {
          setSelected(row);
          setSelectedId(null);
        } else {
          setSelected(null);
          setSelectedId(initialEditId);
        }
        setDrawerMode(isAdmin ? 'edit' : 'view');
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, rows, isAdmin]);

  const openDrawer = (r: RedirectListRow, mode: 'view' | 'edit') => {
    setSelected(r);
    setSelectedId(null);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const openRow = (r: RedirectListRow) => openDrawer(r, 'view');
  const colCount = isAdmin ? 7 : 6;

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Redirects</h1>
            <p className="text-sm text-muted-foreground">Define domain-based redirects for campaigns</p>
          </div>
          {isAdmin ? (
            <Button asChild className="shrink-0 self-start sm:self-auto">
              <Link href="/redirects/new">
                <IconPlus className="mr-2 h-4 w-4" />
                Add Redirect
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-lg border border-border/80 bg-card/30 shadow-sm">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Name</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Source domain</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Subdomains</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Destination</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 text-center font-medium tabular-nums">
                  Campaigns
                </TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Created</TableHead>
                {isAdmin ? (
                  <TableHead className="h-12 min-w-0 px-4 py-3 text-right font-medium">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {isAdmin ? 'No redirects yet. Create your first redirect.' : 'No redirects yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="min-h-[52px] cursor-pointer transition-colors hover:bg-muted/40"
                    tabIndex={0}
                    onClick={() => openRow(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRow(r);
                      }
                    }}
                  >
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block max-w-full cursor-pointer truncate align-middle">
                            {r.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm text-balance">
                          {r.name}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-mono text-sm">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block max-w-full cursor-pointer truncate align-middle">
                            {r.sourceDomain}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm break-all">
                          {r.sourceDomain}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle text-sm">
                      {r.includeSubdomains ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell className="max-w-[220px] min-w-0 px-4 py-3 align-middle">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={r.destinationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block max-w-full cursor-pointer truncate text-primary underline-offset-4 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.destinationUrl}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm break-all">
                          {r.destinationUrl}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle tabular-nums">
                      <div className="flex justify-center">
                        {r.linkedCampaignCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="min-w-7 justify-center px-2.5 py-0.5 tabular-nums font-medium"
                          >
                            {r.linkedCampaignCount}
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
                      {formatDateTimeUtcEnGb(r.createdAt)}
                    </TableCell>
                    {isAdmin ? (
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
                            aria-label={`Edit ${r.name}`}
                            onClick={() => openDrawer(r, 'edit')}
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            name={r.name}
                            entityType="redirect"
                            apiPath={`/api/redirects/${r.id}`}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <RedirectEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        redirect={selected}
        redirectId={selectedId ?? undefined}
        initialMode={drawerMode}
        showEditAction={isAdmin}
      />
    </>
  );
}
