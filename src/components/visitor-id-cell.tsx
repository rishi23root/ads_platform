'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { IconCopy } from '@tabler/icons-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

const TRUNCATE_LENGTH = 24;

interface VisitorIdCellProps {
  visitorId: string;
}

export function VisitorIdCell({ visitorId }: VisitorIdCellProps) {
  const truncated =
    visitorId.length > TRUNCATE_LENGTH ? `${visitorId.slice(0, TRUNCATE_LENGTH)}…` : visitorId;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(visitorId);
      toast.success('Visitor ID copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [visitorId]);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 group">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copyToClipboard}
              className="font-mono text-sm text-left hover:text-primary hover:underline cursor-pointer transition-colors min-w-0 truncate max-w-[200px]"
              title="Click to copy full ID"
            >
              {truncated}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] break-all">
            <p className="font-mono text-xs">{visitorId}</p>
            <p className="text-[10px] opacity-80 mt-1">Click to copy</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copyToClipboard}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity shrink-0"
              aria-label="Copy visitor ID"
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
