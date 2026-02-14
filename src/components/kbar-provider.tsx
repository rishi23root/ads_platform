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
  type Action,
  type ActionImpl,
} from "kbar"
import {
  IconAd2,
  IconBell,
  IconDashboard,
  IconDeviceDesktop,
  IconChartBar,
  IconUsers,
  IconTargetArrow,
  IconUserSearch,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

type Role = "user" | "admin"

function buildActions(role: Role, router: ReturnType<typeof useRouter>): Action[] {
  const baseActions: Action[] = [
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
      id: "campaigns",
      name: "Campaigns",
      shortcut: ["c", "c"],
      keywords: "campaign targets",
      section: "Overview",
      icon: <IconTargetArrow className="size-4" />,
      perform: () => router.push("/campaigns"),
    },
    {
      id: "visitors",
      name: "Visitors",
      shortcut: ["v", "v"],
      keywords: "visitor users",
      section: "Overview",
      icon: <IconUserSearch className="size-4" />,
      perform: () => router.push("/visitors"),
    },
    {
      id: "analytics",
      name: "Extension Insights",
      shortcut: ["a", "a"],
      keywords: "analytics charts insights",
      section: "Overview",
      icon: <IconChartBar className="size-4" />,
      perform: () => router.push("/analytics"),
    },
    {
      id: "platforms",
      name: "Platforms",
      shortcut: ["p", "p"],
      keywords: "platforms devices",
      section: "Content",
      icon: <IconDeviceDesktop className="size-4" />,
      perform: () => router.push("/platforms"),
    },
    {
      id: "ads",
      name: "Ads",
      shortcut: ["a", "d"],
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
  ]

  if (role === "admin") {
    baseActions.push({
      id: "users",
      name: "Users",
      shortcut: ["u", "u"],
      keywords: "users admin",
      section: "Admin",
      icon: <IconUsers className="size-4" />,
      perform: () => router.push("/users"),
    })
  }

  return baseActions
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
