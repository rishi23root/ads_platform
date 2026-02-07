"use client"

import { IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"

import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

export function ThemeMenuContent() {
  const { setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme("light")}>
        <IconSun className="mr-2 h-4 w-4" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("dark")}>
        <IconMoon className="mr-2 h-4 w-4" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("system")}>
        <IconSun className="mr-2 h-4 w-4" />
        <span>System</span>
      </DropdownMenuItem>
    </>
  )
}
