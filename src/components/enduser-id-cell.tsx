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

const TRUNCATE_LENGTH = 24;

interface EndUserIdCellProps {
  /** User identifier (`end_users.identifier`) — copy + display. */
  userIdentifier: string;
  /** Link to admin extension user profile when UUID is known. */
  profileHref?: string | null;
}

export function EndUserIdCell({ userIdentifier, profileHref }: EndUserIdCellProps) {
  const truncated =
    userIdentifier.length > TRUNCATE_LENGTH
      ? `${userIdentifier.slice(0, TRUNCATE_LENGTH)}…`
      : userIdentifier;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userIdentifier);
      toast.success('User identifier copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [userIdentifier]);

  const label = profileHref ? (
    <Link
      href={profileHref}
      className="font-mono text-sm text-left hover:text-primary hover:underline cursor-pointer transition-colors min-w-0 truncate max-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      {truncated}
    </Link>
  ) : (
    <button
      type="button"
      onClick={copyToClipboard}
      className="font-mono text-sm text-left hover:text-primary hover:underline cursor-pointer transition-colors min-w-0 truncate max-w-[200px]"
      title="Click to copy user identifier"
    >
      {truncated}
    </button>
  );

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 group">
        <Tooltip>
          <TooltipTrigger asChild>{label}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] break-all">
            <p className="font-mono text-xs">{userIdentifier}</p>
            <p className="text-[10px] opacity-80 mt-1">
              {profileHref ? 'Open profile or use copy' : 'Click to copy'}
            </p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void copyToClipboard();
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity shrink-0"
              aria-label="Copy user identifier"
            >
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Copy user identifier</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
