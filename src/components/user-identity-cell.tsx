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
  shortId: string;
  displayEmail: string | null;
  /** Optional display name (shown as primary line when set). */
  displayName?: string | null;
}

export function UserIdentityCell({
  endUserId,
  shortId,
  displayEmail,
  displayName,
}: UserIdentityCellProps) {
  const email = displayEmail?.trim() || null;
  const name = displayName?.trim() || null;
  /** Single primary label: name, or email, or short id (not email + short id together). */
  const primary = name ?? email ?? shortId;
  const truncated =
    primary.length > TRUNCATE_LENGTH ? `${primary.slice(0, TRUNCATE_LENGTH)}…` : primary;
  const useMono = !name && !email;

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
          <TooltipContent side="top" className="max-w-[320px] break-all space-y-1">
            <p className="font-mono text-xs">
              <span className="text-muted-foreground">UUID: </span>
              {endUserId}
            </p>
            <p className="font-mono text-xs">
              <span className="text-muted-foreground">Short: </span>
              {shortId}
            </p>
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
