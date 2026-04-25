'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconDownload, IconLoader2 } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Matches tab query `source` on the audience list detail page. */
export type TargetListMembersTabSource = 'all' | 'explicit' | 'filter' | 'excluded';

interface ExportTargetListMembersCsvButtonProps {
  listId: string;
  source: TargetListMembersTabSource;
  className?: string;
}

export function ExportTargetListMembersCsvButton({
  listId,
  source,
  className,
}: ExportTargetListMembersCsvButtonProps) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    const params = new URLSearchParams({ source });
    const url = `/api/target-lists/${listId}/members/export?${params.toString()}`;
    setLoading(true);
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 413) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(typeof data?.error === 'string' ? data.error : 'Export too large for this tab.');
        return;
      }
      if (!res.ok) {
        toast.error('Could not export members. Try signing in again.');
        return;
      }
      const cd = res.headers.get('Content-Disposition');
      let filename = 'audience-members.csv';
      if (cd) {
        const m = /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"|filename=([^;\n]+)/i.exec(cd);
        const raw = m?.[1] ?? m?.[2] ?? m?.[3];
        if (raw) {
          filename = decodeURIComponent(raw.replace(/^"|"$/g, '').trim());
        }
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setLoading(false);
    }
  }, [listId, source]);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={loading}
      onClick={onClick}
      aria-label="Download members as CSV for this tab"
      className={cn(
        'cursor-pointer transition-transform hover:scale-105 active:scale-95',
        'h-8 w-8',
        className
      )}
    >
      {loading ? (
        <IconLoader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <IconDownload className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {loading ? <span className="inline-flex">{trigger}</span> : trigger}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {loading ? 'Exporting…' : 'Download members as CSV (current tab, all rows)'}
      </TooltipContent>
    </Tooltip>
  );
}
