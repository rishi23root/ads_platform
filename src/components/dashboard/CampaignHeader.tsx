'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { getCountryName } from '@/lib/countries';
import type { Campaign } from '@/db/schema';

interface CampaignHeaderProps {
  campaign: Campaign;
  platformDomains: string[];
  countryCodes: string[];
  isAdmin?: boolean;
}

export function CampaignHeader({
  campaign,
  platformDomains,
  countryCodes,
  isAdmin = false,
}: CampaignHeaderProps) {
  const dateRange =
    campaign.startDate || campaign.endDate
      ? `${campaign.startDate ? new Date(campaign.startDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} – ${campaign.endDate ? new Date(campaign.endDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}`
      : null;

  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="capitalize">
            {campaign.status}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {campaign.campaignType}
          </Badge>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/campaigns/${campaign.id}/edit`}>
                <IconPencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <DeleteButton
              id={campaign.id}
              name={campaign.name}
              entityType="campaign"
              apiPath={`/api/campaigns/${campaign.id}`}
              redirectTo="/campaigns"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {dateRange && (
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Date</p>
            <p className="text-sm font-medium">{dateRange}</p>
          </div>
        )}
        {(platformDomains.length > 0 || countryCodes.length >= 0) && (
          <>
            <div className="rounded-lg border bg-card px-3 py-2 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Targets</p>
              <div className="flex flex-wrap gap-1.5">
                {platformDomains.length > 0 ? (
                  <>
                    {platformDomains.slice(0, 5).map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        {d}
                      </span>
                    ))}
                    {platformDomains.length > 5 && (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        +{platformDomains.length - 5}
                      </span>
                    )}
                  </>
                ) : campaign.campaignType === 'notification' ? (
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    All
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Countries</p>
              <div className="flex flex-wrap gap-1.5">
                {countryCodes.length > 0 ? (
                  <>
                    {countryCodes.slice(0, 5).map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        {getCountryName(code)}
                      </span>
                    ))}
                    {countryCodes.length > 5 && (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        +{countryCodes.length - 5}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    All
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
