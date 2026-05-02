"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconAd2,
  IconBell,
  IconBroadcast,
  IconCreditCard,
  IconDashboard,
  IconDeviceDesktop,
  IconInnerShadowTop,
  IconChartBar,
  IconUsers,
  IconTargetArrow,
  IconUserSearch,
  IconRoute,
  IconListCheck,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type Role = "user" | "admin"

// UI label glossary — keep sidebar, breadcrumbs, and PageHeader titles in sync.
// Internal name (route) -> user-facing label shown in the UI.
//   /target-lists  -> Audience lists   (Groups of users your campaigns can target)
//   /platforms     -> Sites & apps     (Websites and apps where your ads can appear)
//   /redirects     -> URL redirects    (Send visitors from one link to another)
//   /delivery/live -> Live (sidebar); breadcrumbs "Live sessions"; page header "Live connections"
//   Extension user -> App user         (People using your extension)
// Update this glossary when dashboard routes are added or renamed.

const overviewItems = [
  { title: "Dashboard", url: "/", icon: IconDashboard },
  { title: "Users", url: "/users", icon: IconUserSearch },
  { title: "Events", url: "/events", icon: IconChartBar },
]

const deliveryItems = [
  { title: "Campaigns", url: "/campaigns", icon: IconTargetArrow },
  { title: "Audience lists", url: "/target-lists", icon: IconListCheck },
  { title: "Live", url: "/delivery/live", icon: IconBroadcast },
]

const contentItems = [
  { title: "Sites & apps", url: "/platforms", icon: IconDeviceDesktop },
  { title: "Ads", url: "/ads", icon: IconAd2 },
  { title: "Notifications", url: "/notifications", icon: IconBell },
  { title: "URL redirects", url: "/redirects", icon: IconRoute },
]

function getNavSections(role: Role) {
  const sections: { label: string; items: typeof overviewItems }[] = [
    { label: "Overview", items: overviewItems },
    { label: "Delivery", items: deliveryItems },
    { label: "Content", items: contentItems },
  ]
  if (role === "admin") {
    sections.push({
      label: "Team",
      items: [
        { title: "Members", url: "/members", icon: IconUsers },
        { title: "Payments", url: "/payments", icon: IconCreditCard },
      ],
    })
  }
  return sections
}

export function AppSidebar({
  user,
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string }
  role: Role
}) {
  const navSections = getNavSections(role)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Adwarden</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <NavMain items={section.items} />
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
