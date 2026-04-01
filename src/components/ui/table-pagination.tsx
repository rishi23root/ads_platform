'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

function PaginationIconTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

type LinkModeFilterParams = Record<string, string>;

type TablePaginationProps =
  | {
    mode: 'link';
    page: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    basePath: string;
    filterParams?: LinkModeFilterParams;
  }
  | {
    mode: 'button';
    page: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };

function buildPageHref(
  basePath: string,
  page: number,
  filterParams?: LinkModeFilterParams
): string {
  const params = new URLSearchParams(filterParams ?? {});
  params.set('page', String(page));
  return `${basePath}?${params.toString()}`;
}

export function TablePagination(props: TablePaginationProps) {
  const { page, totalPages, totalCount, pageSize } = props;
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  if (totalCount === 0) return null;

  const prevHref =
    props.mode === 'link'
      ? buildPageHref(props.basePath, page - 1, props.filterParams)
      : undefined;
  const nextHref =
    props.mode === 'link'
      ? buildPageHref(props.basePath, page + 1, props.filterParams)
      : undefined;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        Showing {start}–{end} of {totalCount.toLocaleString()}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
          {props.mode === 'link' ? (
            <>
              {page <= 1 ? (
                <PaginationIconTooltip label="Previous page">
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled
                      aria-label="Previous page"
                      className="h-7 w-7"
                    >
                      <IconChevronLeft className="h-4 w-4" />
                    </Button>
                  </span>
                </PaginationIconTooltip>
              ) : (
                <PaginationIconTooltip label="Previous page">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    aria-label="Previous page"
                    className="h-7 w-7"
                  >
                    <Link href={prevHref!}>
                      <IconChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </PaginationIconTooltip>
              )}
              {page >= totalPages ? (
                <PaginationIconTooltip label="Next page">
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled
                      aria-label="Next page"
                      className="h-7 w-7"
                    >
                      <IconChevronRight className="h-4 w-4" />
                    </Button>
                  </span>
                </PaginationIconTooltip>
              ) : (
                <PaginationIconTooltip label="Next page">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    aria-label="Next page"
                    className="h-7 w-7"
                  >
                    <Link href={nextHref!}>
                      <IconChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </PaginationIconTooltip>
              )}
            </>
          ) : (
            <>
              {page <= 1 ? (
                <PaginationIconTooltip label="Previous page">
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => props.onPageChange(page - 1)}
                      disabled
                      aria-label="Previous page"
                      className="h-7 w-7"
                    >
                      <IconChevronLeft className="h-4 w-4" />
                    </Button>
                  </span>
                </PaginationIconTooltip>
              ) : (
                <PaginationIconTooltip label="Previous page">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => props.onPageChange(page - 1)}
                    aria-label="Previous page"
                    className="h-7 w-7"
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                </PaginationIconTooltip>
              )}
              {page >= totalPages ? (
                <PaginationIconTooltip label="Next page">
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => props.onPageChange(page + 1)}
                      disabled
                      aria-label="Next page"
                      className="h-7 w-7"
                    >
                      <IconChevronRight className="h-4 w-4" />
                    </Button>
                  </span>
                </PaginationIconTooltip>
              ) : (
                <PaginationIconTooltip label="Next page">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => props.onPageChange(page + 1)}
                    aria-label="Next page"
                    className="h-7 w-7"
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationIconTooltip>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
