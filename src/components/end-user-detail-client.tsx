"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import { PaymentsTable } from "@/components/payments-table"
import { AddPaymentDialog } from "@/components/add-payment-dialog"
import { AdminEndUserSessionsCard } from "@/components/admin-end-user-sessions-card"
import { EndUserAnalyticsSection } from "@/components/end-user-analytics-section"
import { EndUserEventsTimeline } from "@/components/end-user-events-timeline"
import { EndUserDashboardKpis } from "@/components/end-user-dashboard-kpis"
import type { EndUserDashboardSnapshot } from "@/lib/end-user-dashboard-types"
import { IconLoader2 } from "@tabler/icons-react"
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

interface EndUserDetailClientProps {
  initialUser: EndUserDetailInitialUser
  initialPayments: EndUserPaymentListItem[]
  initialDashboard: EndUserDashboardSnapshot
  isAdmin: boolean
}

export function EndUserDetailClient({
  initialUser,
  initialPayments,
  initialDashboard,
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
      (user.id.length > 8 ? `${user.id.slice(0, 8)}…` : user.id) ||
      "Extension user",
    [user.email, user.name, user.identifier, user.id],
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
      setEmail(next.email ?? "")
      setBanned(next.banned)
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

  const idPreview =
    user.id.length > 12 ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : user.id

  const overviewStart = useMemo(
    () =>
      new Date(user.startDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    [user.startDate],
  )
  const overviewEnd = useMemo(
    () =>
      user.endDate
        ? new Date(user.endDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
        : null,
    [user.endDate],
  )
  const overviewCreated = useMemo(
    () =>
      new Date(user.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    [user.createdAt],
  )
  const overviewUpdated = useMemo(
    () =>
      new Date(user.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    [user.updatedAt],
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/users">← Back to users</Link>
        </Button>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                Done
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setEditMode(true)}>
                Edit user
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <header className="space-y-2">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-pretty">
          {pageTitle}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
          User id <span className="font-mono text-foreground">{idPreview}</span>
          {user.identifier ? (
            <>
              {" "}
              · Identifier{" "}
              <span className="font-mono text-foreground">{user.identifier}</span>
            </>
          ) : null}
          .
          {isEditing
            ? " Change fields below and save; charts and timeline are hidden while editing."
            : isAdmin
              ? " Overview shows access and telemetry; edit to change profile, plan, or password."
              : " Overview shows access and telemetry."}
        </p>
      </header>

      {!isEditing ? (
        <EndUserDashboardKpis
          dashboard={initialDashboard}
          recordUpdatedAt={user.updatedAt}
          className="space-y-4"
        />
      ) : null}

      {!isEditing ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border pb-6">
            <CardTitle className="text-lg">Profile and access</CardTitle>
            <CardDescription>Read-only summary. Use Edit user to change these fields.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Identifier
                </dt>
                <dd className="break-words font-mono text-sm font-medium leading-snug">
                  {user.identifier ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </dt>
                <dd className="break-words text-sm font-medium leading-snug">{user.name?.trim() || "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </dt>
                <dd className="break-words text-sm font-medium leading-snug">{user.email ?? "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Plan
                </dt>
                <dd>
                  <Badge variant="secondary" className="font-normal capitalize">
                    {user.plan}
                  </Badge>
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Banned
                </dt>
                <dd>
                  <Badge variant={user.banned ? "destructive" : "secondary"} className="font-normal">
                    {user.banned ? "Yes" : "No"}
                  </Badge>
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Country
                </dt>
                <dd className="break-words text-sm font-medium leading-snug uppercase">
                  {user.country ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Account created
                </dt>
                <dd className="break-words text-sm font-medium leading-snug tabular-nums">
                  {overviewCreated}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last updated
                </dt>
                <dd className="break-words text-sm font-medium leading-snug tabular-nums">
                  {overviewUpdated}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Access starts
                </dt>
                <dd className="break-words text-sm font-medium leading-snug tabular-nums">
                  {overviewStart}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Access ends
                </dt>
                <dd className="break-words text-sm font-medium leading-snug tabular-nums">
                  {overviewEnd ?? "Open-ended"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {!isEditing ? <EndUserAnalyticsSection endUserId={user.id} /> : null}

      {!isEditing ? <EndUserEventsTimeline endUserId={user.id} /> : null}

      {!isEditing ? (
        <AdminEndUserSessionsCard userId={user.id} allowRevoke={isAdmin} />
      ) : null}

      {!isEditing ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
            <div>
              <CardTitle>Payments</CardTitle>
              <CardDescription>Manual payment records for this user.</CardDescription>
            </div>
            {isAdmin ? <AddPaymentDialog userId={user.id} onCreated={refreshPayments} /> : null}
          </CardHeader>
          <CardContent>
            <PaymentsTable
              payments={paymentsForTable}
              onChanged={refreshPayments}
              allowDelete={isAdmin}
            />
          </CardContent>
        </Card>
      ) : null}

      {isEditing ? (
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
                Stable external id from the extension. Shown for support; UUID in the URL is the primary
                key.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                  placeholder={
                    user.identifier ? "Optional until user registers" : "you@example.com"
                  }
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
                    <Label htmlFor="end-user-banned" className="text-base">
                      Banned
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Banned users cannot use extension Bearer sessions.
                    </p>
                  </div>
                  <Switch
                    id="end-user-banned"
                    checked={banned}
                    onCheckedChange={setBanned}
                    disabled={saving}
                  />
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
                <Label htmlFor="endDate">End date</Label>
                <DateTimePicker
                  id="endDate"
                  value={endDate}
                  onChange={setEndDate}
                  disabled={saving}
                  allowClear
                  placeholder="Pick end date & time"
                />
                <p className="text-xs leading-relaxed text-foreground/70 dark:text-foreground/65">
                  Leave empty for open-ended access.
                </p>
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
      ) : null}
    </div>
  )
}
