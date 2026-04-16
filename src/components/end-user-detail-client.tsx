"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/ui/table-pagination"
import { PaymentsTable } from "@/components/payments-table"
import { AddPaymentDialog } from "@/components/add-payment-dialog"
import {
  AdminEndUserSessionsCard,
  type AdminEndUserSessionsCardHandle,
  type AdminEndUserSessionsCardSessionStatus,
} from "@/components/admin-end-user-sessions-card"
import { DateDisplayToggleButton } from "@/components/date-display-toggle-button"
import { ExportPaymentsCsvButton } from "@/components/export-payments-csv-button"
import {
  EndUserAnalyticsSection,
  type AnalyticsPayload,
} from "@/components/end-user-analytics-section"
import { EndUserEventsTimeline } from "@/components/end-user-events-timeline"
import type { EndUserDashboardSnapshot } from "@/lib/end-user-dashboard-types"
import { getCountryName } from "@/lib/countries"
import { cn } from "@/lib/utils"
import {
  IconArrowLeft,
  IconChartBar,
  IconChevronDown,
  IconCreditCard,
  IconDevices,
  IconEdit,
  IconLayoutDashboard,
  IconList,
  IconLoader2,
  IconRefresh,
  IconSettings,
  IconUser,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { PaymentRow } from "@/db/schema"
import { isoOrDateToLocalDatetimeValue, localDatetimeToIso } from "@/lib/datetime-local-format"

export type EndUserDetailInitialUser = {
  id: string
  email: string | null
  identifier: string | null
  name: string | null
  plan: string
  banned: boolean
  country: string | null
  startDate: string
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export type EndUserPaymentListItem = {
  id: string
  endUserId: string
  amount: number
  currency: string
  status: string
  description: string | null
  paymentDate: string
  createdAt: string
}

export type EndUserApiRow = {
  id: string
  email: string | null
  identifier: string | null
  name: string | null
  plan: string
  banned: boolean
  country: string | null
  startDate: Date | string
  endDate: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

function mapApiUserToInitial(u: EndUserApiRow): EndUserDetailInitialUser {
  return {
    id: String(u.id),
    email: u.email,
    identifier: u.identifier,
    name: u.name,
    plan: String(u.plan),
    banned: Boolean(u.banned),
    country: u.country,
    startDate:
      typeof u.startDate === "string" ? u.startDate : new Date(u.startDate).toISOString(),
    endDate: u.endDate
      ? typeof u.endDate === "string"
        ? u.endDate
        : new Date(u.endDate).toISOString()
      : null,
    createdAt:
      typeof u.createdAt === "string" ? u.createdAt : new Date(u.createdAt).toISOString(),
    updatedAt:
      typeof u.updatedAt === "string" ? u.updatedAt : new Date(u.updatedAt).toISOString(),
  }
}

function paymentsToRows(items: EndUserPaymentListItem[]): PaymentRow[] {
  return items.map((p) => ({
    id: p.id,
    endUserId: p.endUserId,
    amount: p.amount,
    currency: p.currency,
    status: p.status as PaymentRow["status"],
    description: p.description,
    paymentDate: new Date(p.paymentDate),
    createdAt: new Date(p.createdAt),
  }))
}

const DISPLAY_LOCALE = "en-US"

function formatWhen(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(DISPLAY_LOCALE, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return "—"
  }
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

type TabKey = "overview" | "events" | "manage"

interface EndUserDetailClientProps {
  initialUser: EndUserDetailInitialUser
  initialPayments: EndUserPaymentListItem[]
  initialDashboard: EndUserDashboardSnapshot
  initialAnalytics: AnalyticsPayload
  isAdmin: boolean
}

export function EndUserDetailClient({
  initialUser,
  initialPayments,
  initialDashboard,
  initialAnalytics,
  isAdmin,
}: EndUserDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isEditing = isAdmin && searchParams.get("edit") === "1"

  const setEditMode = useCallback(
    (on: boolean) => {
      const p = new URLSearchParams(searchParams.toString())
      if (on) p.set("edit", "1")
      else p.delete("edit")
      const q = p.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const [user, setUser] = useState(initialUser)
  const [payments, setPayments] = useState(initialPayments)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [mountedTabs, setMountedTabs] = useState<Set<TabKey>>(new Set(["overview"]))
  const [topDomains, setTopDomains] = useState<AnalyticsPayload["topDomains"] | null>(
    initialAnalytics.topDomains,
  )

  const [name, setName] = useState(user.name ?? "")
  const [email, setEmail] = useState(user.email ?? "")
  const [plan, setPlan] = useState(user.plan)
  const [banned, setBanned] = useState(user.banned)
  const [country, setCountry] = useState(user.country ?? "")
  const [startDate, setStartDate] = useState(() => isoOrDateToLocalDatetimeValue(user.startDate))
  const [endDate, setEndDate] = useState(() => isoOrDateToLocalDatetimeValue(user.endDate))
  const [newPassword, setNewPassword] = useState("")

  const paymentsForTable = useMemo(() => paymentsToRows(payments), [payments])

  const pageTitle = useMemo(
    () =>
      user.name?.trim() ||
      user.email ||
      user.identifier ||
      "Extension user",
    [user.email, user.name, user.identifier],
  )

  useEffect(() => {
    setUser(initialUser)
    setName(initialUser.name ?? "")
    setEmail(initialUser.email ?? "")
    setPlan(initialUser.plan)
    setBanned(initialUser.banned)
    setCountry(initialUser.country ?? "")
    setStartDate(isoOrDateToLocalDatetimeValue(initialUser.startDate))
    setEndDate(isoOrDateToLocalDatetimeValue(initialUser.endDate))
  }, [initialUser])

  const onTabChange = useCallback((value: string) => {
    const tab = value as TabKey
    setActiveTab(tab)
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }, [])

  const refreshPayments = useCallback(async () => {
    const [payRes, userRes] = await Promise.all([
      fetch(`/api/end-users/${user.id}/payments`),
      fetch(`/api/end-users/${user.id}`),
    ])
    if (payRes.ok) {
      const data = (await payRes.json()) as { data: EndUserPaymentListItem[] }
      setPayments(
        data.data.map((p) => ({
          ...p,
          paymentDate:
            typeof p.paymentDate === "string" ? p.paymentDate : new Date(p.paymentDate).toISOString(),
          createdAt:
            typeof p.createdAt === "string" ? p.createdAt : new Date(p.createdAt).toISOString(),
        }))
      )
    }
    if (userRes.ok) {
      const { user: u } = (await userRes.json()) as { user: EndUserApiRow }
      const next = mapApiUserToInitial(u)
      setUser(next)
      setName(next.name ?? "")
      setEmail(next.email ?? "")
      setBanned(next.banned)
      setPlan(next.plan)
      setStartDate(isoOrDateToLocalDatetimeValue(next.startDate))
      setEndDate(isoOrDateToLocalDatetimeValue(next.endDate))
    }
    router.refresh()
  }, [router, user.id])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const countryTrim = country.trim()
      if (countryTrim !== "" && countryTrim.length !== 2) {
        toast.error("Country must be empty or a 2-letter code")
        setSaving(false)
        return
      }

      const startIso = localDatetimeToIso(startDate)
      if (!startIso) {
        toast.error("Start date is required")
        setSaving(false)
        return
      }

      const emailTrim = email.trim().toLowerCase()
      if (emailTrim === "" && !user.identifier) {
        toast.error("Email is required unless this user has an identifier (anonymous).")
        setSaving(false)
        return
      }

      const body: Record<string, unknown> = {
        name: name.trim() || null,
        email: emailTrim === "" ? null : emailTrim,
        plan,
        banned,
        country: countryTrim === "" ? null : countryTrim.toUpperCase(),
        startDate: startIso,
        endDate: endDate.trim() ? localDatetimeToIso(endDate) : null,
      }

      if (newPassword.length > 0) {
        if (newPassword.length < 8) {
          toast.error("Password must be at least 8 characters")
          setSaving(false)
          return
        }
        body.password = newPassword
      }

      const res = await fetch(`/api/end-users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json()) as { error?: string }
        toast.error(j.error ?? "Save failed")
        return
      }
      const data = (await res.json()) as { user: EndUserApiRow }
      const next = mapApiUserToInitial(data.user)
      setUser(next)
      setEmail(next.email ?? "")
      setBanned(next.banned)
      setPlan(next.plan)
      setStartDate(isoOrDateToLocalDatetimeValue(next.startDate))
      setEndDate(isoOrDateToLocalDatetimeValue(next.endDate))
      setNewPassword("")
      toast.success("Saved")
      setEditMode(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const onDeleteUser = async () => {
    if (!confirm("Delete this extension user? Session, payments, and linked rows will be removed.")) {
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/end-users/${user.id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Could not delete user")
        return
      }
      toast.success("User deleted")
      router.push("/users")
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
          <Link href="/users">
            <IconArrowLeft className="h-4 w-4" aria-hidden />
            Users
          </Link>
        </Button>
        {isAdmin ? (
          isEditing ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode(false)}>
              <IconX className="h-4 w-4" aria-hidden />
              Cancel editing
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode(true)}>
              <IconEdit className="h-4 w-4" aria-hidden />
              Edit user
            </Button>
          )
        ) : null}
      </div>

      {/* ── User header ── */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight sm:text-2xl">
              {pageTitle}
            </h1>
            <Badge
              variant={user.plan === "paid" ? "default" : "secondary"}
              className="font-normal capitalize shrink-0"
            >
              {user.plan}
            </Badge>
            {user.banned ? (
              <Badge variant="destructive" className="font-normal shrink-0">Banned</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {user.identifier ? (
              <span className="font-mono text-xs">{user.identifier}</span>
            ) : null}
            {user.email ? (
              <>
                {user.identifier && <span className="text-border" aria-hidden>·</span>}
                <span className="text-xs">{user.email}</span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Edit form (replaces tabs) ── */}
      {isEditing ? (
        <div className="pt-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div>
                <CardTitle>Edit extension user</CardTitle>
                <CardDescription>Update profile, subscription window, and password.</CardDescription>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={onDeleteUser}
                className="shrink-0"
              >
                {deleting ? "Deleting…" : "Delete user"}
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSave} className="grid w-full gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="end-user-identifier">Identifier</Label>
                  <Input
                    id="end-user-identifier"
                    readOnly
                    value={user.identifier ?? ""}
                    placeholder="—"
                    className="font-mono bg-muted/50 text-sm"
                    aria-readonly
                  />
                  <p className="text-xs text-muted-foreground">
                    Stable external id from the extension.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={saving}
                      placeholder={user.identifier ? "Optional until user registers" : "you@example.com"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="end-user-plan">Plan</Label>
                    <Select value={plan} onValueChange={setPlan} disabled={saving}>
                      <SelectTrigger id="end-user-plan" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg border border-border/80 p-4 sm:min-h-[72px] sm:justify-center">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="end-user-banned" className="text-base">Banned</Label>
                        <p className="text-xs text-muted-foreground">
                          Banned users cannot use extension Bearer sessions.
                        </p>
                      </div>
                      <Switch id="end-user-banned" checked={banned} onCheckedChange={setBanned} disabled={saving} />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country (ISO2)</Label>
                  <Input
                    id="country"
                    placeholder="e.g. US"
                    maxLength={2}
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="startDate">Start date</Label>
                    <DateTimePicker
                      id="startDate"
                      value={startDate}
                      onChange={setStartDate}
                      disabled={saving}
                      placeholder="Pick start date & time"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="endDate" className="items-start">
                      <span className="leading-snug">
                        End date{" "}
                        <span className="font-normal text-muted-foreground">
                          (Leave empty for open-ended access.)
                        </span>
                      </span>
                    </Label>
                    <DateTimePicker
                      id="endDate"
                      value={endDate}
                      onChange={setEndDate}
                      disabled={saving}
                      allowClear
                      placeholder="Pick end date & time"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New password (optional)</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    disabled={saving}
                  />
                </div>
                <Button type="submit" disabled={saving} className="w-fit">
                  {saving ? (
                    <>
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <UserDetailKpiStrip user={user} dashboard={initialDashboard} />

          {/* ── Tabbed content ── */}
          <Tabs
            value={activeTab}
            onValueChange={onTabChange}
            className="mt-5 w-full min-w-0 gap-4 self-start"
          >
            <TabsList className="h-auto w-fit max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-xl border border-border/70 bg-card/40 p-1 shadow-none">
              <TabsTrigger
                value="overview"
                className="gap-1.5 rounded-lg px-3 sm:px-4 flex-none border-0 shadow-none text-muted-foreground data-[state=active]:bg-muted/55 data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-muted/35"
              >
                <IconLayoutDashboard className="h-4 w-4 hidden sm:block" aria-hidden />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="gap-1.5 rounded-lg px-3 sm:px-4 flex-none border-0 shadow-none text-muted-foreground data-[state=active]:bg-muted/55 data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-muted/35"
              >
                <IconList className="h-4 w-4 hidden sm:block" aria-hidden />
                Events
              </TabsTrigger>
              <TabsTrigger
                value="manage"
                className="gap-1.5 rounded-lg px-3 sm:px-4 flex-none border-0 shadow-none text-muted-foreground data-[state=active]:bg-muted/55 data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-muted/35"
              >
                <IconSettings className="h-4 w-4 hidden sm:block" aria-hidden />
                Manage
              </TabsTrigger>
            </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="mt-0 flex-none outline-none">
            <OverviewBentoGrid
              user={user}
              dashboard={initialDashboard}
              initialAnalytics={initialAnalytics}
              topDomains={topDomains}
              onTopDomainsChange={setTopDomains}
            />
          </TabsContent>

          {/* ── Events Tab (lazy) ── */}
          <TabsContent value="events" className="mt-0 flex-none outline-none">
            {mountedTabs.has("events") ? (
              <EndUserEventsTimeline endUserId={user.id} />
            ) : null}
          </TabsContent>

          {/* ── Manage Tab (lazy) — sessions + payments ── */}
          <TabsContent value="manage" className="mt-0 flex-none outline-none">
            {mountedTabs.has("manage") ? (
              <ManageTabContent
                userId={user.id}
                isAdmin={isAdmin}
                payments={paymentsForTable}
                onPaymentsChanged={refreshPayments}
              />
            ) : null}
          </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Lifetime KPI strip — above tabs, full width
 * ──────────────────────────────────────────────────────────────────────────── */

function UserDetailKpiStrip({
  user,
  dashboard,
}: {
  user: EndUserDetailInitialUser
  dashboard: EndUserDashboardSnapshot
}) {
  const { payments, events } = dashboard

  const paymentsLabel =
    payments.completedCount > 0
      ? `${formatMoney(payments.completedSumAmount, payments.currency)} · ${payments.completedCount} paid`
      : "No completed payments"

  const overviewCreated = useMemo(
    () => new Date(user.createdAt).toLocaleString(DISPLAY_LOCALE, { dateStyle: "medium", timeStyle: "short" }),
    [user.createdAt],
  )

  return (
    <section aria-label="User overview metrics" className="mt-6 w-full min-w-0">
      <div className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 xl:grid-cols-5">
        <KpiStat label="Lifetime events" value={events.total.toLocaleString(DISPLAY_LOCALE)} />
        <KpiStat
          label="First activity"
          value={formatWhen(events.firstAt)}
          hint={events.total === 0 ? "No telemetry yet" : undefined}
        />
        <KpiStat label="Last activity" value={formatWhen(events.lastAt)} />
        <KpiStat label="Payments" value={paymentsLabel} />
        <KpiStat label="Member since" value={overviewCreated} />
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Overview bento grid — chart + profile + domains + campaigns
 * ──────────────────────────────────────────────────────────────────────────── */

type DomainRow = { domain: string; visits: number; serves: number }

function OverviewBentoGrid({
  user,
  dashboard,
  initialAnalytics,
  topDomains,
  onTopDomainsChange,
}: {
  user: EndUserDetailInitialUser
  dashboard: EndUserDashboardSnapshot
  initialAnalytics: AnalyticsPayload
  topDomains: DomainRow[] | null
  onTopDomainsChange: (domains: DomainRow[] | null) => void
}) {
  const { events } = dashboard

  const overviewStart = useMemo(
    () => new Date(user.startDate).toLocaleString(DISPLAY_LOCALE, { dateStyle: "medium", timeStyle: "short" }),
    [user.startDate],
  )
  const overviewEnd = useMemo(
    () =>
      user.endDate
        ? new Date(user.endDate).toLocaleString(DISPLAY_LOCALE, { dateStyle: "medium", timeStyle: "short" })
        : null,
    [user.endDate],
  )

  const handleDataLoaded = useCallback(
    (data: AnalyticsPayload | null) => {
      onTopDomainsChange(data?.topDomains ?? null)
    },
    [onTopDomainsChange],
  )

  const thMuted = "text-muted-foreground text-xs font-normal"

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: 70/30 split (7fr / 3fr); both cards stretch to the same row height */}
      <div className="grid min-h-[20rem] gap-3 lg:grid-cols-[7fr_3fr] lg:items-stretch">
        {/* Chart card — 70% */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card/40 shadow-none">
          <EndUserAnalyticsSection
            endUserId={user.id}
            embedded
            className="min-h-0 flex-1"
            initialData={initialAnalytics}
            onDataLoaded={handleDataLoaded}
          />
        </div>

        {/* Profile card — 30%, full height of row */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card/40 px-4 pb-4 pt-4 shadow-none">
          <h3 className="text-sm font-medium flex items-center gap-2 text-foreground shrink-0">
            <IconUser className="h-4 w-4 text-muted-foreground" aria-hidden />
            Profile &amp; access
          </h3>
          <dl className="mt-3 flex min-h-0 flex-1 flex-col gap-3 text-sm">
            <ProfileRow label="Identifier" value={user.identifier} mono />
            <ProfileRow label="Name" value={user.name?.trim()} />
            <ProfileRow label="Email" value={user.email} />
            <div className="grid grid-cols-[minmax(5.5rem,7.5rem)_minmax(0,1fr)] items-center gap-x-3">
              <dt className="text-xs font-medium text-muted-foreground">Plan</dt>
              <dd className="min-w-0 justify-self-start">
                <Badge
                  variant={user.plan === "paid" ? "default" : "secondary"}
                  className="font-normal capitalize"
                >
                  {user.plan}
                </Badge>
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(5.5rem,7.5rem)_minmax(0,1fr)] items-center gap-x-3">
              <dt className="text-xs font-medium text-muted-foreground">Banned</dt>
              <dd className="min-w-0 justify-self-start">
                <Badge variant={user.banned ? "destructive" : "secondary"} className="font-normal">
                  {user.banned ? "Yes" : "No"}
                </Badge>
              </dd>
            </div>
            <ProfileRow label="Access starts" value={overviewStart} tabular />
            <ProfileRow label="Access ends" value={overviewEnd ?? "Open-ended"} tabular />
            <ProfileEventCountriesRow
              countries={dashboard.eventCountries}
              className="mt-auto shrink-0"
            />
          </dl>
        </div>
      </div>

      {/* Row 2: Campaigns (3/5) + Top domains (2/5) — card shell + stretch for bento */}
      <div className="grid gap-3 lg:grid-cols-5 lg:items-stretch">
        <section
          className="lg:col-span-3 flex min-h-[280px] flex-col rounded-xl border border-border bg-card/40 px-4 pb-3 pt-3 shadow-none lg:h-full lg:min-h-[min(320px,40vh)]"
          aria-labelledby="user-campaigns-heading"
        >
          <h3
            id="user-campaigns-heading"
            className="text-sm font-medium flex items-center gap-2 text-foreground"
          >
            <IconChartBar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Campaigns with events
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-snug">
            {events.distinctCampaignsWithEvents > 0
              ? `Top ${Math.min(20, dashboard.campaigns.length)} by event volume (${events.distinctCampaignsWithEvents} distinct).`
              : "No campaign-linked events yet."}
          </p>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            {dashboard.campaigns.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                No rows to show.
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="w-full min-w-0 overflow-x-auto">
                  <Table className="w-full table-auto">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={thMuted}>Campaign</TableHead>
                        <TableHead className={`${thMuted} text-right tabular-nums`}>Events</TableHead>
                        <TableHead className={`${thMuted} w-16 text-right`}>
                          <span className="sr-only">Open</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.campaigns.map((row) => (
                        <TableRow key={row.campaignId}>
                          <TableCell className="py-2 font-medium text-sm">{row.campaignName}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums text-sm">
                            {row.eventCount.toLocaleString(DISPLAY_LOCALE)}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Link
                              href={`/campaigns/${row.campaignId}`}
                              className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </section>

               <section
          className="lg:col-span-2 flex min-h-[280px] flex-col rounded-xl border border-border bg-card/40 px-4 pb-3 pt-3 shadow-none lg:h-full lg:min-h-[min(320px,40vh)]"
          aria-labelledby="user-top-domains-heading"
        >
          <h3
            id="user-top-domains-heading"
            className="text-sm font-medium flex items-center gap-2 text-foreground"
          >
            <IconWorld className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Top domains
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-snug">
            Most visited &amp; served domains in current chart range.
          </p>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            {topDomains === null ? (
              <div className="flex flex-1 flex-col justify-center space-y-2 rounded-lg bg-muted/10 p-4">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            ) : topDomains.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                No domain data in this range.
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="w-full min-w-0 overflow-x-auto">
                  <Table className="w-full table-auto">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={thMuted}>Domain</TableHead>
                        <TableHead className={`${thMuted} text-right tabular-nums`}>Visits</TableHead>
                        <TableHead className={`${thMuted} text-right tabular-nums`}>Served</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDomains.map((row) => (
                        <TableRow key={row.domain}>
                          <TableCell className="py-2 font-mono text-xs max-w-[min(12rem,40vw)] truncate md:max-w-none" title={row.domain}>
                            {row.domain}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums text-sm">
                            {row.visits.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums text-sm">
                            {row.serves.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Manage Tab — sessions + payments via single combined fetch
 * ──────────────────────────────────────────────────────────────────────────── */

type SessionRow = {
  id: string
  createdAt: string
  expiresAt: string
  userAgent: string | null
  ipAddress: string | null
  active: boolean
}

const MANAGE_PAYMENTS_PAGE_SIZE = 25

function ManageTabContent({
  userId,
  isAdmin,
  payments,
  onPaymentsChanged,
}: {
  userId: string
  isAdmin: boolean
  payments: PaymentRow[]
  onPaymentsChanged: () => Promise<void>
}) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [payPage, setPayPage] = useState(1)
  const [paymentsOpen, setPaymentsOpen] = useState(true)
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const sessionsCardRef = useRef<AdminEndUserSessionsCardHandle>(null)
  const [sessionUi, setSessionUi] = useState<{ loading: boolean; busy: boolean }>({
    loading: false,
    busy: false,
  })

  const onSessionStatusChange = useCallback((s: AdminEndUserSessionsCardSessionStatus) => {
    setSessionUi(s)
  }, [])

  const paymentTotal = payments.length
  const paymentTotalPages = Math.max(1, Math.ceil(paymentTotal / MANAGE_PAYMENTS_PAGE_SIZE))

  const paymentsExportParams = useMemo(() => ({ endUserId: userId }), [userId])

  const paymentsPageRows = useMemo(() => {
    const start = (payPage - 1) * MANAGE_PAYMENTS_PAGE_SIZE
    return payments.slice(start, start + MANAGE_PAYMENTS_PAGE_SIZE)
  }, [payments, payPage])

  useEffect(() => {
    setPayPage((p) => Math.min(p, paymentTotalPages))
  }, [paymentTotalPages])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/end-users/${encodeURIComponent(userId)}/manage`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { sessions?: SessionRow[] }) => {
        if (!cancelled) setSessions(Array.isArray(data.sessions) ? data.sessions : [])
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
    return () => { cancelled = true }
  }, [userId])

  const paymentsPaginationEl =
    paymentTotal > 0 ? (
      <TablePagination
        mode="button"
        page={payPage}
        totalPages={paymentTotalPages}
        totalCount={paymentTotal}
        pageSize={MANAGE_PAYMENTS_PAGE_SIZE}
        onPageChange={setPayPage}
      />
    ) : null

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className="min-h-0 gap-0 overflow-hidden border-border bg-card/40 py-0 shadow-none">
        <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
          <CardHeader className="flex flex-col gap-3 space-y-0 px-4 pb-2 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle
                id="user-payments-heading"
                className="flex items-center gap-2 text-base font-semibold leading-none"
              >
                <IconCreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">Payment records ({paymentTotal.toLocaleString()})</span>
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Manual payment entries for this extension user.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {paymentsPaginationEl}
              {isAdmin ? <ExportPaymentsCsvButton filterParams={paymentsExportParams} /> : null}
              <DateDisplayToggleButton />
              {isAdmin ? <AddPaymentDialog userId={userId} onCreated={onPaymentsChanged} /> : null}
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  aria-expanded={paymentsOpen}
                  aria-label={paymentsOpen ? "Collapse payment records" : "Expand payment records"}
                >
                  <IconChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      paymentsOpen ? "rotate-0" : "-rotate-90",
                    )}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="max-h-[min(28rem,52vh)] min-h-0 overflow-auto">
                <PaymentsTable
                  payments={paymentsPageRows}
                  onChanged={onPaymentsChanged}
                  allowDelete={isAdmin}
                  embedded
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card className="min-h-0 gap-0 overflow-hidden border-border bg-card/40 py-0 shadow-none">
        <Collapsible open={sessionsOpen} onOpenChange={setSessionsOpen}>
          <CardHeader className="flex flex-col gap-3 space-y-0 px-4 pb-2 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold leading-none">
                <IconDevices className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">Extension session</span>
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                One bearer session at a time. Revoking ends access until the user signs in again.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <DateDisplayToggleButton />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={sessionUi.busy}
                onClick={() => void sessionsCardRef.current?.refresh()}
                aria-label="Refresh session"
                className="h-8 w-8"
              >
                <IconRefresh
                  className={cn(
                    "h-4 w-4 shrink-0",
                    sessionUi.loading &&
                      "motion-safe:animate-spin motion-reduce:animate-none",
                  )}
                  aria-hidden
                />
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  aria-expanded={sessionsOpen}
                  aria-label={sessionsOpen ? "Collapse extension session" : "Expand extension session"}
                >
                  <IconChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      sessionsOpen ? "rotate-0" : "-rotate-90",
                    )}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="min-h-0 px-4 pb-4 pt-0">
              <AdminEndUserSessionsCard
                ref={sessionsCardRef}
                userId={userId}
                allowRevoke={isAdmin}
                initialSessions={sessions}
                embedded
                suppressEmbeddedToolbar
                onSessionStatusChange={onSessionStatusChange}
              />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Shared sub-components
 * ──────────────────────────────────────────────────────────────────────────── */

function KpiStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card/40 px-3 py-3 shadow-none sm:px-4">
      <p className="text-xs font-medium leading-snug text-muted-foreground">{label}</p>
      <p className="mt-1 min-w-0 break-words text-lg font-bold tabular-nums leading-tight text-balance text-foreground sm:text-xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function ProfileRow({
  label,
  value,
  mono,
  tabular,
  className,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  tabular?: boolean
  className?: string
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-1 min-w-0 sm:grid-cols-[minmax(5.5rem,7.5rem)_minmax(0,1fr)] sm:items-start sm:gap-x-3 sm:gap-y-0 ${className ?? ""}`}
    >
      <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd
        className={`text-sm font-medium leading-snug text-foreground min-w-0 break-words ${mono ? "font-mono text-xs sm:text-sm" : ""} ${tabular ? "tabular-nums" : ""}`}
        title={typeof value === "string" && value.length > 48 ? value : undefined}
      >
        {value || "—"}
      </dd>
    </div>
  )
}

function ProfileEventCountriesRow({
  countries,
  className,
}: {
  countries: EndUserDashboardSnapshot["eventCountries"]
  className?: string
}) {
  if (countries.length === 0) {
    return (
      <div className={cn("min-w-0 rounded-lg bg-muted/25 px-3 py-3", className)}>
        <p className="text-xs font-medium text-muted-foreground">Countries (from extension events)</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No country recorded on events yet. The extension stores an ISO2 code on each event when
          available.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("min-w-0 rounded-lg bg-muted/25 px-3 py-3", className)}>
      <p className="text-xs font-medium text-muted-foreground">Countries (from extension events)</p>
      <ul className="mt-2 flex flex-col gap-3" role="list">
        {countries.map(({ code, eventCount }) => {
          const name = getCountryName(code)
          const showName = name !== code
          return (
            <li key={code}>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {showName ? name : code}
                </span>
                {showName ? (
                  <Badge variant="outline" className="w-fit shrink-0 font-mono text-xs uppercase">
                    {code}
                  </Badge>
                ) : null}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {eventCount.toLocaleString(DISPLAY_LOCALE)} events
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
