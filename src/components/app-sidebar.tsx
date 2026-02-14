"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconAd2,
  IconBell,
  IconDashboard,
  IconDeviceDesktop,
  IconInnerShadowTop,
  IconChartBar,
  IconUsers,
  IconTargetArrow,
  IconUserSearch,
} from "@tabler/icons-react"

import { KBarTrigger } from "@/components/kbar-trigger"
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

const overviewItems = [
  { title: "Dashboard", url: "/", icon: IconDashboard },
  { title: "Campaigns", url: "/campaigns", icon: IconTargetArrow },
  { title: "Visitors", url: "/visitors", icon: IconUserSearch },
  { title: "Extension Insights", url: "/analytics", icon: IconChartBar },
]

const contentItems = [
  { title: "Platforms", url: "/platforms", icon: IconDeviceDesktop },
  { title: "Ads", url: "/ads", icon: IconAd2 },
  { title: "Notifications", url: "/notifications", icon: IconBell },
]

function getNavSections(role: Role) {
  const sections: { label: string; items: typeof overviewItems }[] = [
    { label: "Overview", items: overviewItems },
  ]
  if (role === "admin") {
    sections.push({ label: "Content", items: contentItems })
    sections.push({
      label: "Admin",
      items: [{ title: "Users", url: "/users", icon: IconUsers }],
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
        <KBarTrigger />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
