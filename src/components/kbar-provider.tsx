"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  useRegisterActions,
  type Action,
  type ActionImpl,
} from "kbar"
import {
  IconAd2,
  IconBell,
  IconBroadcast,
  IconDashboard,
  IconDeviceDesktop,
  IconChartBar,
  IconUsers,
  IconTargetArrow,
  IconUserSearch,
  IconUserCircle,
  IconRoute,
  IconListCheck,
  IconCreditCard,
  IconMoon,
  IconSun,
} from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

type Role = "user" | "admin"

function buildActions(role: Role, router: ReturnType<typeof useRouter>): Action[] {
  const overview: Action[] = [
    {
      id: "dashboard",
      name: "Dashboard",
      shortcut: ["d", "d"],
      keywords: "home overview",
      section: "Overview",
      icon: <IconDashboard className="size-4" />,
      perform: () => router.push("/"),
    },
    {
      id: "users",
      name: "Users",
      shortcut: ["u", "u"],
      keywords: "end user users extension app user",
      section: "Overview",
      icon: <IconUserSearch className="size-4" />,
      perform: () => router.push("/users"),
    },
    {
      id: "events",
      name: "Events",
      shortcut: ["e", "e"],
      keywords: "events logs extension activity charts impressions",
      section: "Overview",
      icon: <IconChartBar className="size-4" />,
      perform: () => router.push("/events"),
    },
    {
      id: "account",
      name: "Account",
      shortcut: ["a", "c"],
      keywords: "settings profile password sessions security",
      section: "Overview",
      icon: <IconUserCircle className="size-4" />,
      perform: () => router.push("/account"),
    },
  ]

  const delivery: Action[] = [
    {
      id: "campaigns",
      name: "Campaigns",
      shortcut: ["c", "c"],
      keywords: "campaign targets",
      section: "Delivery",
      icon: <IconTargetArrow className="size-4" />,
      perform: () => router.push("/campaigns"),
    },
    {
      id: "target-lists",
      name: "Audience lists",
      shortcut: ["a", "l"],
      keywords: "audience segment list cohort target",
      section: "Delivery",
      icon: <IconListCheck className="size-4" />,
      perform: () => router.push("/target-lists"),
    },
    {
      id: "delivery-live",
      name: "Live",
      shortcut: ["d", "l"],
      keywords: "live connections sse extension realtime sessions online heartbeat",
      section: "Delivery",
      icon: <IconBroadcast className="size-4" />,
      perform: () => router.push("/delivery/live"),
    },
  ]

  const content: Action[] = [
    {
      id: "platforms",
      name: "Sites & apps",
      shortcut: ["s", "a"],
      keywords: "platforms sites apps websites devices",
      section: "Content",
      icon: <IconDeviceDesktop className="size-4" />,
      perform: () => router.push("/platforms"),
    },
    {
      id: "ads",
      name: "Ads",
      shortcut: ["a", "a"],
      keywords: "ads advertisements",
      section: "Content",
      icon: <IconAd2 className="size-4" />,
      perform: () => router.push("/ads"),
    },
    {
      id: "notifications",
      name: "Notifications",
      shortcut: ["n", "n"],
      keywords: "notifications alerts bell",
      section: "Content",
      icon: <IconBell className="size-4" />,
      perform: () => router.push("/notifications"),
    },
    {
      id: "redirects",
      name: "URL redirects",
      shortcut: ["r", "r"],
      keywords: "redirects url links domains routing",
      section: "Content",
      icon: <IconRoute className="size-4" />,
      perform: () => router.push("/redirects"),
    },
  ]

  if (role !== "admin") {
    return [...overview, ...delivery, ...content]
  }

  const team: Action[] = [
    {
      id: "members",
      name: "Members",
      shortcut: ["m", "m"],
      keywords: "members users roles team",
      section: "Team",
      icon: <IconUsers className="size-4" />,
      perform: () => router.push("/members"),
    },
    {
      id: "payments",
      name: "Payments",
      shortcut: ["p", "y"],
      keywords: "payments revenue subscriptions billing",
      section: "Team",
      icon: <IconCreditCard className="size-4" />,
      perform: () => router.push("/payments"),
    },
  ]

  return [...overview, ...delivery, ...content, ...team]
}

const KBAR_THEME_PARENT = "kbar-theme"

function KBarThemeRegister() {
  const { setTheme, resolvedTheme } = useTheme()

  const themeActions = React.useMemo<Action[]>(
    () => [
      {
        id: KBAR_THEME_PARENT,
        name: "Choose theme…",
        keywords: "theme appearance color interface mode dark light system",
        section: "Appearance",
        icon: <IconSun className="size-4" />,
      },
      {
        id: "kbar-theme-light",
        name: "Use light theme",
        keywords: "light appearance",
        section: "",
        parent: KBAR_THEME_PARENT,
        icon: <IconSun className="size-4" />,
        perform: () => setTheme("light"),
      },
      {
        id: "kbar-theme-dark",
        name: "Use dark theme",
        keywords: "dark appearance night",
        section: "",
        parent: KBAR_THEME_PARENT,
        icon: <IconMoon className="size-4" />,
        perform: () => setTheme("dark"),
      },
      {
        id: "kbar-theme-system",
        name: "Use system theme",
        keywords: "system default os appearance",
        section: "",
        parent: KBAR_THEME_PARENT,
        icon: <IconSun className="size-4" />,
        perform: () => setTheme("system"),
      },
      {
        id: "kbar-theme-toggle",
        name: "Toggle light/dark",
        keywords: "theme appearance dark light toggle switch",
        section: "Appearance",
        shortcut: ["t", "t"],
        icon: <IconMoon className="size-4" />,
        perform: () =>
          setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ],
    [setTheme, resolvedTheme]
  )

  useRegisterActions(themeActions, [themeActions])
  return null
}

function RenderResults() {
  const { results } = useMatches()

  return (
    <KBarResults
      items={results}
      maxHeight={400}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {item}
          </div>
        ) : (
          <ResultItem action={item} active={active} />
        )
      }
    />
  )
}

function ResultItem({
  action,
  active,
}: {
  action: ActionImpl
  active: boolean
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 px-4 py-3",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        {action.icon}
        <span className="text-sm font-medium">{action.name}</span>
      </div>
      {action.shortcut?.length ? (
        <div className="flex gap-1" aria-hidden>
          {action.shortcut.map((sc, i) => (
            <kbd
              key={`${sc}-${i}`}
              className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono"
            >
              {sc}
            </kbd>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function KBarProviderWrapper({
  children,
  role,
}: {
  children: React.ReactNode
  role: Role
}) {
  const router = useRouter()
  const actions = React.useMemo(
    () => buildActions(role, router),
    [role, router]
  )

  return (
    <KBarProvider actions={actions}>
      <KBarThemeRegister />
      {children}
      <KBarPortal>
        <KBarPositioner className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <KBarAnimator className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border bg-popover shadow-lg">
            <KBarSearch
              defaultPlaceholder="Search or type a command..."
              className="w-full border-b bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </KBarProvider>
  )
}
