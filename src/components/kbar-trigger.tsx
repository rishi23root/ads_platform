"use client"

import { useKBar } from "kbar"
import { IconCommand } from "@tabler/icons-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function KBarTrigger() {
  const { query } = useKBar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Search (⌘K)"
          onClick={() => query.toggle()}
        >
          <IconCommand className="size-4" />
          <span>Search</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
