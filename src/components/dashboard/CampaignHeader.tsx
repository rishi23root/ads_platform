'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { campaignStatusBadgeVariant } from '@/lib/campaign-display';
import type { Campaign } from '@/db/schema';

interface CampaignHeaderProps {
  campaign: Campaign;
  isAdmin?: boolean;
}

export function CampaignHeader({ campaign, isAdmin = false }: CampaignHeaderProps) {
  return (
    <header className="space-y-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between gap-y-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{campaign.name}</h1>
            <Badge
              variant={campaignStatusBadgeVariant(campaign.status)}
              className="capitalize shrink-0"
            >
              {campaign.status}
            </Badge>
            <Badge variant="outline" className="capitalize shrink-0">
              {campaign.campaignType}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Summary and performance below. Edit delivery rules from the campaign form.
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="min-h-9">
              <Link href={`/campaigns/${campaign.id}/edit`}>
                <IconPencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <DeleteButton
              name={campaign.name}
              entityType="campaign"
              apiPath={`/api/campaigns/${campaign.id}`}
              redirectTo="/campaigns"
            />
          </div>
        )}
      </div>
    </header>
  );
}
