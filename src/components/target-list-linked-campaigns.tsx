import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { campaignStatusBadgeVariant } from '@/lib/campaign-display';
import type { TargetListLinkedCampaignRow } from '@/lib/target-list-queries';
import { cn } from '@/lib/utils';
import { IconChevronRight } from '@tabler/icons-react';

function campaignTypeLabel(t: TargetListLinkedCampaignRow['campaignType']): string {
  if (t === 'ads') return 'Ads';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function TargetListLinkedCampaigns({
  campaigns,
  className,
}: {
  campaigns: TargetListLinkedCampaignRow[];
  className?: string;
}) {
  return (
    <section
      aria-label="Campaigns using this target list"
      className={cn('flex min-h-0 flex-col bg-muted/20 px-5 py-5', className)}
    >
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Connected campaigns
        {campaigns.length > 0 ? (
          <span className="ml-1.5 font-normal normal-case tabular-nums text-muted-foreground/60">
            ({campaigns.length})
          </span>
        ) : null}
      </h2>

      {campaigns.length === 0 ? (
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          None yet — assign this list as the target audience in a campaign.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50 overflow-x-hidden overflow-y-auto max-h-[min(50vh,22rem)]">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/campaigns/${c.id}`}
                className={cn(
                  'group flex items-center justify-between gap-3 py-3 text-sm',
                  'motion-safe:transition-opacity hover:opacity-80',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground leading-snug">
                    {c.name}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="font-normal text-xs">
                      {campaignTypeLabel(c.campaignType)}
                    </Badge>
                    <Badge
                      variant={campaignStatusBadgeVariant(c.status)}
                      className="font-normal capitalize text-xs"
                    >
                      {c.status}
                    </Badge>
                  </span>
                </span>
                <IconChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
