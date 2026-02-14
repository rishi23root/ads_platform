"use client"

import { IconCheck, IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"

import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

export function ThemeMenuContent() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme("light")}>
        <IconSun className="mr-2 h-4 w-4" />
        <span>Light</span>
        {theme === "light" && <IconCheck className="ml-auto h-4 w-4" />}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("dark")}>
        <IconMoon className="mr-2 h-4 w-4" />
        <span>Dark</span>
        {theme === "dark" && <IconCheck className="ml-auto h-4 w-4" />}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("system")}>
        <IconSun className="mr-2 h-4 w-4" />
        <span>System</span>
        {theme === "system" && <IconCheck className="ml-auto h-4 w-4" />}
      </DropdownMenuItem>
    </>
  )
}
