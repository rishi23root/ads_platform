import { IconEye, IconTrendingUp, IconUsers } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

interface SectionCardsProps {
  activeCampaigns: number;
  totalCampaigns: number;
  campaignImpressions: number;
  activeUsers: number;
  liveUsers?: number;
  /** Footer under extension user count when `liveUsers` is not set (e.g. scoped metric for non-admins). */
  extensionUsersCaption?: string;
  /** Optional card to prepend to the grid (e.g. live connections) */
  extraCard?: React.ReactNode;
}

export function SectionCards({
  activeCampaigns,
  totalCampaigns,
  campaignImpressions,
  activeUsers,
  liveUsers,
  extensionUsersCaption,
  extraCard,
}: SectionCardsProps) {
  const activePercentage = totalCampaigns > 0 ? Math.round((activeCampaigns / totalCampaigns) * 100) : 0;

  return (
    <section
      aria-label="Key metrics"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      {extraCard}
      <Card className="border-border bg-card/40 py-4 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active campaigns</CardTitle>
          <Badge
            variant="outline"
            className="bg-green-500/10 text-green-600 dark:text-green-400"
          >
            <IconTrendingUp className="size-3" />
            {activePercentage}%
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{activeCampaigns}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {totalCampaigns} total campaigns
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/40 py-4 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Impressions</CardTitle>
          <IconEye className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{campaignImpressions}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ad, popup, and notification events on campaigns (all time)
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/40 py-4 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Extension users</CardTitle>
          <IconUsers className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{activeUsers}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {liveUsers !== undefined
              ? `${liveUsers} live right now`
              : extensionUsersCaption ?? 'All accounts registered with the extension'}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
