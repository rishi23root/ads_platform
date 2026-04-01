'use client';

import { useDateDisplayPreference } from '@/components/date-display-preference';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconCalendarEvent, IconClockHour3 } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface DateDisplayToggleButtonProps {
  className?: string;
}

/**
 * Toggles table date cells between relative phrasing (e.g. “today at …”) and locale medium + short time.
 */
export function DateDisplayToggleButton({ className }: DateDisplayToggleButtonProps) {
  const { preference, toggle } = useDateDisplayPreference();
  const isRelative = preference === 'relative';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={toggle}
          aria-label={isRelative ? 'Switch to exact dates' : 'Switch to relative dates'}
          aria-pressed={!isRelative}
          className={cn(
            'cursor-pointer transition-transform hover:scale-105 active:scale-95 h-8 w-8',
            className
          )}
        >
          {isRelative ? (
            <IconClockHour3 className="h-4 w-4" aria-hidden />
          ) : (
            <IconCalendarEvent className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isRelative ? 'Show exact date & time' : 'Show relative dates'}
      </TooltipContent>
    </Tooltip>
  );
}
