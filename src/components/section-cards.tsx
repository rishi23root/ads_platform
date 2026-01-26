import { IconAd2, IconBell, IconDeviceDesktop, IconTrendingUp, IconUsers, IconChartBar } from "@tabler/icons-react"

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
  totalAds: number;
  activeAds: number;
  expiredAds: number;
  scheduledAds: number;
  totalPlatforms: number;
  activePlatforms: number;
  totalNotifications: number;
  unreadNotifications: number;
  totalExtensionUsers: number;
  totalRequests: number;
  adsServed: number;
  notificationsSent: number;
}

export function SectionCards({
  totalAds,
  activeAds,
  expiredAds,
  scheduledAds,
  totalPlatforms,
  activePlatforms,
  totalNotifications,
  unreadNotifications,
  totalExtensionUsers,
  totalRequests,
  adsServed,
  notificationsSent,
}: SectionCardsProps) {
  const activeAdsPercentage = totalAds > 0 ? Math.round((activeAds / totalAds) * 100) : 0;

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Ads</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalAds}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconAd2 className="size-3" />
              {activeAds} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {scheduledAds} scheduled, {expiredAds} expired
          </div>
          <div className="text-muted-foreground">
            {activeAdsPercentage}% currently active
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Ads</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activeAds}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
              <IconTrendingUp className="size-3" />
              {activeAdsPercentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Currently running campaigns
          </div>
          <div className="text-muted-foreground">
            {totalAds - activeAds - expiredAds - scheduledAds} inactive
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Platforms</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalPlatforms}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconDeviceDesktop className="size-3" />
              {activePlatforms} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {activePlatforms} active platforms
          </div>
          <div className="text-muted-foreground">
            {totalPlatforms - activePlatforms} inactive
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Notifications</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalNotifications}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={unreadNotifications > 0 ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : ""}>
              <IconBell className="size-3" />
              {unreadNotifications} unread
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'All caught up'}
          </div>
          <div className="text-muted-foreground">
            {totalNotifications - unreadNotifications} read
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Extension Users</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalExtensionUsers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconUsers className="size-3" />
              {totalRequests} requests
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total extension users
          </div>
          <div className="text-muted-foreground">
            {totalRequests} total requests logged
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Requests</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalRequests}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconChartBar className="size-3" />
              All time
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Extension requests logged
          </div>
          <div className="text-muted-foreground">
            {adsServed} ads, {notificationsSent} notifications
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Ads Served</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {adsServed}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
              <IconAd2 className="size-3" />
              Served
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total ad requests
          </div>
          <div className="text-muted-foreground">
            From extension users
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Notifications Sent</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {notificationsSent}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconBell className="size-3" />
              Sent
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total notification requests
          </div>
          <div className="text-muted-foreground">
            From extension users
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
