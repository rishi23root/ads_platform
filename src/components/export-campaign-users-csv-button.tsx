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

interface ExportCampaignUsersCsvButtonProps {
  campaignId: string;
  className?: string;
}

export function ExportCampaignUsersCsvButton({
  campaignId,
  className,
}: ExportCampaignUsersCsvButtonProps) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/users/export`, {
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Could not export campaign users. Try signing in again.');
        return;
      }
      const cd = res.headers.get('Content-Disposition');
      let filename = 'campaign-users.csv';
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
  }, [campaignId]);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={loading}
      onClick={onClick}
      aria-label="Download all campaign users as CSV"
      className={cn(
        'cursor-pointer transition-transform hover:scale-105 active:scale-95 h-8 w-8',
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
        {loading ? 'Exporting…' : 'Download all campaign users as CSV'}
      </TooltipContent>
    </Tooltip>
  );
}
