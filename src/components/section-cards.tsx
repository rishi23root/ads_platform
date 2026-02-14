import { IconChartBar, IconTrendingUp, IconUsers } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SectionCardsProps {
  activeCampaigns: number;
  totalCampaigns: number;
  campaignLogs: number;
  activeUsers: number;
  liveUsers?: number;
  /** Optional card to prepend to the grid (e.g. live connections) */
  extraCard?: React.ReactNode;
}

export function SectionCards({
  activeCampaigns,
  totalCampaigns,
  campaignLogs,
  activeUsers,
  liveUsers,
  extraCard,
}: SectionCardsProps) {
  const activePercentage = totalCampaigns > 0 ? Math.round((activeCampaigns / totalCampaigns) * 100) : 0;

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {extraCard}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Campaigns</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activeCampaigns}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
              <IconTrendingUp className="size-3" />
              {activePercentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Currently running campaigns
          </div>
          <div className="text-muted-foreground">
            {totalCampaigns} total campaigns
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Campaign Logs</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {campaignLogs}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconChartBar className="size-3" />
              Extension requests
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Ad/notification/popup requests
          </div>
          <div className="text-muted-foreground">
            From extension users
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Users</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activeUsers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconUsers className="size-3" />
              {liveUsers !== undefined ? `${liveUsers} live` : 'Visitors'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Unique extension visitors
          </div>
          <div className="text-muted-foreground">
            {liveUsers !== undefined ? `${liveUsers} currently connected` : 'Tracked in visitors table'}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
