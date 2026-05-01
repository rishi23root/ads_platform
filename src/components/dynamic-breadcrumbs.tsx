"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/delivery": "Delivery",
  "/delivery/live": "Live sessions",
  "/campaigns": "Campaigns",
  "/users": "Users",
  "/platforms": "Sites & apps",
  "/ads": "Ads",
  "/notifications": "Notifications",
  "/events": "Events",
  "/target-lists": "Audience lists",
  "/redirects": "URL redirects",
  "/new": "New",
  "/edit": "Edit",
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function DynamicBreadcrumbs() {
  const pathname = usePathname()
  const [targetListNameById, setTargetListNameById] = React.useState<Record<string, string>>({})

  // Split pathname into segments
  const segments = pathname.split("/").filter(Boolean)

  React.useEffect(() => {
    const segs = pathname.split("/").filter(Boolean)
    const i = segs.indexOf("target-lists")
    const id = i >= 0 ? segs[i + 1] : null
    if (!id || !UUID_RE.test(id)) {
      return
    }
    let cancelled = false
    void fetch(`/api/target-lists/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string } | null) => {
        if (cancelled || !d || typeof d.name !== "string") return
        const name = d.name
        setTargetListNameById((prev) => (prev[id] === name ? prev : { ...prev, [id]: name }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname])

  // Build breadcrumb items
  const breadcrumbItems = [
    {
      label: "Dashboard",
      href: "/",
    },
  ]

  // Build path progressively
  let currentPath = ""
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`

    // Check if it's a dynamic route (UUID, numeric id, or extension user id)
    const isDynamicRoute =
      UUID_RE.test(segment) ||
      Boolean(segment.match(/^\d+$/)) ||
      segment.startsWith("ext_")

    let label: string
    if (isDynamicRoute) {
      // For dynamic routes, try to get a meaningful label
      // Check if previous segment gives context
      if (segments[index - 1]) {
        const parentSegment = segments[index - 1]
        if (parentSegment === "target-lists" && UUID_RE.test(segment)) {
          const name = targetListNameById[segment]
          const display = name
            ? name.length > 40
              ? `${name.slice(0, 39)}…`
              : name
            : "…"
          label = display
        } else if (parentSegment === "campaigns") {
          label = "Campaign details"
        } else if (parentSegment === "users") {
          label = "User details"
        } else {
          const parentLabel =
            routeLabels[`/${parentSegment}`] ||
            parentSegment.charAt(0).toUpperCase() + parentSegment.slice(1)
          label = `${parentLabel} Details`
        }
      } else {
        label = segment.slice(0, 8) + "..."
      }
    } else {
      // Use route label or capitalize segment
      label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1)
    }

    breadcrumbItems.push({
      label,
      href: currentPath,
    })
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1

          return (
            <React.Fragment key={item.href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
