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

interface ExportCsvButtonProps {
  filterParams: Record<string, string>;
  className?: string;
}

export function ExportCsvButton({ filterParams, className }: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    const params = new URLSearchParams(filterParams);
    const qs = params.toString();
    const url = qs ? `/api/users/export?${qs}` : '/api/users/export';
    setLoading(true);
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        toast.error('Could not export users. Try signing in again.');
        return;
      }
      const cd = res.headers.get('Content-Disposition');
      let filename = 'users.csv';
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
  }, [filterParams]);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={loading}
      onClick={onClick}
      aria-label="Export users as CSV"
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
        {loading ? 'Exporting…' : 'Download users as CSV (current filters)'}
      </TooltipContent>
    </Tooltip>
  );
}
