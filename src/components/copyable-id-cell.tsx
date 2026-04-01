'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { IconCopy } from '@tabler/icons-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

interface CopyableIdCellProps {
  value: string;
  truncateLength?: number;
  copyLabel?: string;
  className?: string;
  /** When set, the ID text opens this URL; copy still uses the copy icon. */
  href?: string;
}

const primaryClassName =
  'font-mono text-sm text-left hover:text-primary hover:underline cursor-pointer transition-colors min-w-0 truncate w-full max-w-full';

export function CopyableIdCell({
  value,
  truncateLength = 12,
  copyLabel = 'ID copied to clipboard',
  className,
  href,
}: CopyableIdCellProps) {
  const truncated =
    value.length > truncateLength ? `${value.slice(0, truncateLength)}…` : value;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(copyLabel);
    } catch {
      toast.error('Failed to copy');
    }
  }, [value, copyLabel]);

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1.5 group min-w-0 ${className ?? ''}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            {href ? (
              <Link
                href={href}
                className={primaryClassName}
                title="Open linked page"
              >
                {truncated}
              </Link>
            ) : (
              <button
                type="button"
                onClick={copyToClipboard}
                className={primaryClassName}
                title="Click to copy full ID"
              >
                {truncated}
              </button>
            )}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] break-all">
            <p className="font-mono text-xs">{value}</p>
            <p className="text-[10px] opacity-80 mt-1">
              {href ? 'Click to open · use copy icon to copy' : 'Click to copy'}
            </p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copyToClipboard}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity shrink-0"
              aria-label="Copy ID"
            >
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Copy full ID</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
