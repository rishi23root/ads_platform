"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { PaymentsTable } from "@/components/payments-table"
import { AddPaymentDialog } from "@/components/add-payment-dialog"
import { AdminEndUserSessionsCard } from "@/components/admin-end-user-sessions-card"
import { EndUserAnalyticsSection } from "@/components/end-user-analytics-section"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import type { PaymentRow } from "@/db/schema"
import { isoOrDateToLocalDatetimeValue, localDatetimeToIso } from "@/lib/datetime-local-format"

export type EndUserDetailInitialUser = {
  id: string
  email: string | null
  shortId: string
  installationId: string | null
  name: string | null
  plan: string
  status: string
  country: string | null
  startDate: string
  endDate: string | null
  createdAt: string
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
  shortId: string
  installationId: string | null
  name: string | null
  plan: string
  status: string
  country: string | null
  startDate: Date | string
  endDate: Date | string | null
  createdAt: Date | string
}

function mapApiUserToInitial(u: EndUserApiRow): EndUserDetailInitialUser {
  return {
    id: String(u.id),
    email: u.email,
    shortId: u.shortId,
    installationId: u.installationId,
    name: u.name,
    plan: String(u.plan),
    status: String(u.status),
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
}

export function EndUserDetailClient({ initialUser, initialPayments }: EndUserDetailClientProps) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [payments, setPayments] = useState(initialPayments)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState(user.name ?? "")
  const [email, setEmail] = useState(user.email ?? "")
  const [plan, setPlan] = useState(user.plan)
  const [status, setStatus] = useState(user.status)
  const [country, setCountry] = useState(user.country ?? "")
  const [startDate, setStartDate] = useState(() => isoOrDateToLocalDatetimeValue(user.startDate))
  const [endDate, setEndDate] = useState(() => isoOrDateToLocalDatetimeValue(user.endDate))
  const [newPassword, setNewPassword] = useState("")

  const paymentsForTable = useMemo(() => paymentsToRows(payments), [payments])

  useEffect(() => {
    setUser(initialUser)
    setName(initialUser.name ?? "")
    setEmail(initialUser.email ?? "")
    setPlan(initialUser.plan)
    setStatus(initialUser.status)
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
      if (emailTrim === "" && !user.installationId) {
        toast.error("Email is required unless this user has an installation id (anonymous).")
        setSaving(false)
        return
      }

      const body: Record<string, unknown> = {
        name: name.trim() || null,
        email: emailTrim === "" ? null : emailTrim,
        plan,
        status,
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
      setStartDate(isoOrDateToLocalDatetimeValue(next.startDate))
      setEndDate(isoOrDateToLocalDatetimeValue(next.endDate))
      setNewPassword("")
      toast.success("Saved")
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/users">← Back to users</Link>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={onDeleteUser}
        >
          {deleting ? "Deleting…" : "Delete user"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit extension user</CardTitle>
          <CardDescription>Update profile, subscription window, and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="grid gap-4 max-w-xl">
            <div className="grid gap-2">
              <Label>Short ID</Label>
              <Input
                readOnly
                value={user.shortId}
                className="font-mono bg-muted/50"
                aria-readonly
              />
            </div>
            {user.installationId ? (
              <div className="grid gap-2">
                <Label>Installation ID</Label>
                <Input
                  readOnly
                  value={user.installationId}
                  className="font-mono bg-muted/50 text-sm"
                  aria-readonly
                />
                <p className="text-xs text-muted-foreground">
                  Anonymous extension install id. User can register later to attach an email.
                </p>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                placeholder={user.installationId ? "Optional until user registers" : "you@example.com"}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={setPlan} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start date</Label>
              <DateTimePicker
                id="startDate"
                value={startDate}
                onChange={setStartDate}
                disabled={saving}
                placeholder="Pick start date & time"
              />
            </div>
            <div className="grid gap-2">
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

      <AdminEndUserSessionsCard userId={user.id} />

      <EndUserAnalyticsSection endUserId={user.id} />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Manual payment records for this user.</CardDescription>
          </div>
          <AddPaymentDialog userId={user.id} onCreated={refreshPayments} />
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={paymentsForTable} onChanged={refreshPayments} />
        </CardContent>
      </Card>
    </div>
  )
}
