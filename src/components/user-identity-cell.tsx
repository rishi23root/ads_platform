'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { IconCopy } from '@tabler/icons-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

const TRUNCATE_LENGTH = 28;

interface UserIdentityCellProps {
  endUserId: string;
  identifier: string | null;
  displayEmail: string | null;
  /** Optional display name (shown as primary line when set). */
  displayName?: string | null;
}

export function UserIdentityCell({
  endUserId,
  identifier,
  displayEmail,
  displayName,
}: UserIdentityCellProps) {
  const email = displayEmail?.trim() || null;
  const name = displayName?.trim() || null;
  const idSuffix = endUserId.length > 8 ? `${endUserId.slice(0, 8)}…` : endUserId;
  /** Single primary label: name, email, identifier, or shortened UUID. */
  const primary = name ?? email ?? identifier ?? idSuffix;
  const truncated =
    primary.length > TRUNCATE_LENGTH ? `${primary.slice(0, TRUNCATE_LENGTH)}…` : primary;
  const useMono = !name && !email && !identifier;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(endUserId);
      toast.success('User ID copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [endUserId]);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 group min-w-0 max-w-[240px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/users/${endUserId}`}
              className={
                useMono
                  ? 'font-mono text-sm text-left hover:text-primary hover:underline min-w-0 truncate'
                  : 'text-sm text-left hover:text-primary hover:underline min-w-0 truncate'
              }
            >
              {truncated}
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[min(90vw,480px)] space-y-1 overflow-x-auto text-left [&_p]:whitespace-nowrap"
          >
            <p className="font-mono text-xs">
              <span className="text-muted-foreground">UUID: </span>
              {endUserId}
            </p>
            {identifier ? (
              <p className="font-mono text-xs">
                <span className="text-muted-foreground">Identifier: </span>
                {identifier}
              </p>
            ) : null}
            {email ? (
              <p className="text-xs">
                <span className="text-muted-foreground">Email: </span>
                {email}
              </p>
            ) : null}
            {name ? (
              <p className="text-xs">
                <span className="text-muted-foreground">Name: </span>
                {name}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copyToClipboard}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity shrink-0"
              aria-label="Copy user UUID"
            >
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Copy user UUID</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
