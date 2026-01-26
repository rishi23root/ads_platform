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
  "/platforms": "Platforms",
  "/ads": "Ads",
  "/notifications": "Notifications",
  "/new": "New",
  "/edit": "Edit",
}

export function DynamicBreadcrumbs() {
  const pathname = usePathname()

  // Split pathname into segments
  const segments = pathname.split("/").filter(Boolean)

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

    // Check if it's a dynamic route (UUID or ID)
    const isDynamicRoute = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || segment.match(/^\d+$/)

    let label: string
    if (isDynamicRoute) {
      // For dynamic routes, try to get a meaningful label
      // Check if previous segment gives context
      if (segments[index - 1]) {
        const parentLabel = routeLabels[`/${segments[index - 1]}`] || segments[index - 1]
        label = `${parentLabel} Details`
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
