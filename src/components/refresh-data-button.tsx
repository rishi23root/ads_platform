'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconRefresh } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface RefreshDataButtonProps {
  ariaLabel?: string;
  /** Shown on hover; defaults to `ariaLabel`. */
  tooltip?: string;
  className?: string;
}

/**
 * Client component that refreshes server-rendered data without a full page reload.
 * Uses Next.js router.refresh() to re-fetch the current route's RSC payload.
 */
export function RefreshDataButton({
  ariaLabel = 'Refresh data',
  tooltip,
  className,
}: RefreshDataButtonProps) {
  const router = useRouter();
  const tooltipText = tooltip ?? ariaLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => router.refresh()}
          aria-label={ariaLabel}
          className={cn(
            'cursor-pointer transition-transform hover:scale-105 active:scale-95',
            className ?? 'h-8 w-8'
          )}
        >
          <IconRefresh className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
