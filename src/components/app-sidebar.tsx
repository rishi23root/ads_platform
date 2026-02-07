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
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { SidebarThemeToggle } from "@/components/sidebar-theme-toggle"
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

const data = {
  user: {
    name: "Admin",
    email: "admin@example.com",
  },
  navSections: [
    {
      label: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: IconDashboard,
        },
        {
          title: "Extension Insights",
          url: "/analytics",
          icon: IconChartBar,
        },
      ],
    },
    {
      label: "Content",
      items: [
        {
          title: "Platforms",
          url: "/platforms",
          icon: IconDeviceDesktop,
        },
        {
          title: "Ads",
          url: "/ads",
          icon: IconAd2,
        },
        {
          title: "Notifications",
          url: "/notifications",
          icon: IconBell,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
                <span className="text-base font-semibold">Admin Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <NavMain items={section.items} />
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarThemeToggle />
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
