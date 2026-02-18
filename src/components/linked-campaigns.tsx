'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { IconLoader2, IconTargetArrow } from '@tabler/icons-react';

interface LinkedCampaign {
  id: string;
  name: string;
  campaignType: string;
  status: string;
}

interface LinkedCampaignsProps {
  type: 'ad' | 'notification';
  entityId: string;
}

export function LinkedCampaigns({ type, entityId }: LinkedCampaignsProps) {
  const [campaigns, setCampaigns] = useState<LinkedCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiPath = type === 'ad' ? `/api/ads/${entityId}/campaigns` : `/api/notifications/${entityId}/campaigns`;
    fetch(apiPath)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to fetch campaigns');
        }
        return res.json();
      })
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [type, entityId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        Loading linked campaigns...
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive py-2">{error}</p>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <IconTargetArrow className="h-4 w-4" />
          Linked campaigns
        </p>
        <p className="text-sm text-muted-foreground mt-1">Not linked to any campaigns</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <IconTargetArrow className="h-4 w-4" />
        Linked campaigns ({campaigns.length})
      </p>
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id}>
            <Link
              href={`/campaigns/${c.id}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
            >
              <span className="font-medium truncate flex-1">{c.name}</span>
              <Badge variant="outline" className="shrink-0 capitalize text-xs">
                {c.campaignType}
              </Badge>
              <Badge
                variant={c.status === 'active' ? 'default' : 'secondary'}
                className="shrink-0 capitalize text-xs"
              >
                {c.status}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
