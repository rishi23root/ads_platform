'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/db/schema';
import {
  campaignAudienceLabel,
  campaignFrequencyLabel,
  campaignScheduleWindowLabel,
} from '@/lib/campaign-display';
import {
  IconCalendarEvent,
  IconChevronDown,
  IconClock,
  IconUsers,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

interface CampaignConfigCardProps {
  campaign: Campaign;
  targetList: { id: string; name: string } | null;
}

function FactBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: TablerIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-muted/25 px-3 py-3 min-w-0">
      <Icon className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="text-sm font-medium leading-snug text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

export function CampaignConfigCard({ campaign, targetList }: CampaignConfigCardProps) {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const created = campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const updated = campaign.updatedAt
    ? new Date(campaign.updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  const audienceSummary = targetList
    ? targetList.name
    : campaignAudienceLabel(campaign.targetAudience);

  const audienceDetail = targetList ? (
    <Link
      href={`/target-lists/${targetList.id}`}
      className="text-inherit underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
    >
      {targetList.name}
    </Link>
  ) : (
    campaignAudienceLabel(campaign.targetAudience)
  );

  const collapsedSummary = [audienceSummary, campaignFrequencyLabel(campaign), campaignScheduleWindowLabel(campaign.startDate, campaign.endDate)].join(
    ' · '
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border bg-card/50 py-0 shadow-sm gap-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            className={cn(
              'flex w-full items-start gap-3 border-b border-border/80 bg-muted/10 px-4 py-4 text-left sm:px-5',
              'transition-colors hover:bg-muted/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'motion-reduce:transition-none'
            )}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle className="text-base font-semibold tracking-tight">
                Delivery &amp; targeting
              </CardTitle>
              <CardDescription
                id={`${contentId}-summary`}
                className="text-sm leading-relaxed text-balance line-clamp-2 md:line-clamp-1"
              >
                {collapsedSummary}
              </CardDescription>
              <p className="text-xs text-muted-foreground pt-0.5">
                {open ? 'Collapse details' : 'Expand for schedule and rules'}
              </p>
            </div>
            <IconChevronDown
              className={cn(
                'mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none',
                open && 'rotate-180'
              )}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent id={contentId}>
          <CardContent className="px-4 py-4 sm:px-5 sm:py-5 space-y-5">
            <p className="sr-only">Full schedule, frequency, and audience list for this campaign.</p>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Schedule &amp; rules
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FactBlock
                  icon={IconUsers}
                  label={targetList ? 'Audience list' : 'Audience'}
                  value={audienceDetail}
                />
                <FactBlock
                  icon={IconClock}
                  label="Frequency"
                  value={campaignFrequencyLabel(campaign)}
                />
                <FactBlock
                  icon={IconCalendarEvent}
                  label="Schedule"
                  value={campaignScheduleWindowLabel(campaign.startDate, campaign.endDate)}
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">Created</span>
                <span className="mx-1.5 text-border" aria-hidden>
                  ·
                </span>
                {created}
              </span>
              <span>
                <span className="font-medium text-foreground">Last updated</span>
                <span className="mx-1.5 text-border" aria-hidden>
                  ·
                </span>
                {updated}
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
