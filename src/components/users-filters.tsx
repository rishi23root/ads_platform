"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconFilter } from "@tabler/icons-react"

const ALL_COUNTRIES_VALUE = "__all__"
const ALL_PLANS_VALUE = "__all_plans__"
const ALL_STATUS_VALUE = "__all_status__"

interface UsersFiltersProps {
  q?: string
  joinedFrom?: string
  joinedTo?: string
  lastSeenFrom?: string
  lastSeenTo?: string
  country?: string
  plan?: "trial" | "paid"
  status?: "active" | "suspended" | "churned"
  countryOptions: { code: string; name: string }[]
}

export function UsersFilters({
  q,
  joinedFrom,
  joinedTo,
  lastSeenFrom,
  lastSeenTo,
  country,
  plan,
  status,
  countryOptions,
}: UsersFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [countryValue, setCountryValue] = useState(country ?? ALL_COUNTRIES_VALUE)
  const [planValue, setPlanValue] = useState(plan ?? ALL_PLANS_VALUE)
  const [statusValue, setStatusValue] = useState(status ?? ALL_STATUS_VALUE)
  const [qValue, setQValue] = useState(q ?? "")
  const [joinedFromValue, setJoinedFromValue] = useState(joinedFrom ?? "")
  const [joinedToValue, setJoinedToValue] = useState(joinedTo ?? "")
  const [lastSeenFromValue, setLastSeenFromValue] = useState(lastSeenFrom ?? "")
  const [lastSeenToValue, setLastSeenToValue] = useState(lastSeenTo ?? "")

  useEffect(() => {
    queueMicrotask(() => setCountryValue(country ?? ALL_COUNTRIES_VALUE))
  }, [country])

  useEffect(() => {
    queueMicrotask(() => setPlanValue(plan ?? ALL_PLANS_VALUE))
  }, [plan])

  useEffect(() => {
    queueMicrotask(() => setStatusValue(status ?? ALL_STATUS_VALUE))
  }, [status])

  useEffect(() => {
    queueMicrotask(() => setQValue(q ?? ""))
  }, [q])

  useEffect(() => {
    queueMicrotask(() => {
      setJoinedFromValue(joinedFrom ?? "")
      setJoinedToValue(joinedTo ?? "")
      setLastSeenFromValue(lastSeenFrom ?? "")
      setLastSeenToValue(lastSeenTo ?? "")
    })
  }, [joinedFrom, joinedTo, lastSeenFrom, lastSeenTo])

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      params.delete("endUserId")
      params.delete("page")
      params.delete("browser")
      params.delete("os")
      router.push(`/users?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    updateFilters({
      q: qValue.trim() || undefined,
      joinedFrom: joinedFromValue || undefined,
      joinedTo: joinedToValue || undefined,
      lastSeenFrom: lastSeenFromValue || undefined,
      lastSeenTo: lastSeenToValue || undefined,
      country: countryValue && countryValue !== ALL_COUNTRIES_VALUE ? countryValue.trim() : undefined,
      plan:
        planValue === "trial" || planValue === "paid"
          ? planValue
          : undefined,
      status:
        statusValue === "active" || statusValue === "suspended" || statusValue === "churned"
          ? statusValue
          : undefined,
    })
  }

  const handleClear = () => {
    setQValue("")
    setJoinedFromValue("")
    setJoinedToValue("")
    setLastSeenFromValue("")
    setLastSeenToValue("")
    setCountryValue(ALL_COUNTRIES_VALUE)
    setPlanValue(ALL_PLANS_VALUE)
    setStatusValue(ALL_STATUS_VALUE)
    router.push("/users")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFilter className="h-4 w-4" />
          Filters
        </CardTitle>
        <CardDescription>
          Search by UUID, short ID, email, name, or installation id — or narrow by date, country, and plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              name="q"
              type="text"
              placeholder="Email, short ID, UUID, name, or installation id (partial match)"
              value={qValue}
              onChange={(e) => setQValue(e.target.value)}
              className="w-full font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
                Date range
              </p>
              <p className="text-[11px] leading-snug text-foreground/70 dark:text-foreground/65 max-w-3xl">
                Inclusive: from ≤ event ≤ to. Date-only &quot;to&quot; → end of that day (23:59:59.999).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="joinedFrom">Joined from</Label>
                <DateTimePicker
                  id="joinedFrom"
                  value={joinedFromValue}
                  onChange={setJoinedFromValue}
                  allowClear
                  placeholder="Pick date & time"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinedTo">Joined to</Label>
                <DateTimePicker
                  id="joinedTo"
                  value={joinedToValue}
                  onChange={setJoinedToValue}
                  allowClear
                  placeholder="Pick date & time"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastSeenFrom">Last session from</Label>
                <DateTimePicker
                  id="lastSeenFrom"
                  value={lastSeenFromValue}
                  onChange={setLastSeenFromValue}
                  allowClear
                  placeholder="Pick date & time"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastSeenTo">Last session to</Label>
                <DateTimePicker
                  id="lastSeenTo"
                  value={lastSeenToValue}
                  onChange={setLastSeenToValue}
                  allowClear
                  placeholder="Pick date & time"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
              Location and plan
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={countryValue} onValueChange={setCountryValue}>
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_COUNTRIES_VALUE}>All countries</SelectItem>
                    {countryOptions.map(({ code, name }) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Select value={planValue} onValueChange={setPlanValue}>
                  <SelectTrigger id="plan" className="w-full">
                    <SelectValue placeholder="All plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PLANS_VALUE}>All plans</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUS_VALUE}>All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </form>

        <div
          className="mt-6 rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-foreground/75 dark:text-foreground/70"
          role="note"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85 mb-2">
            How the table uses your filters
          </p>
          <ul className="list-none space-y-2 text-xs leading-relaxed">
            <li>
              <span className="font-medium text-foreground">Dates</span> — Ranges are inclusive. If you
              pick a date without a time for &quot;to&quot;, we include the rest of that calendar day.
            </li>
            <li>
              <span className="font-medium text-foreground">Country</span> — Stored on the extension
              user profile (updated when the extension calls the API with geo headers).
            </li>
            <li>
              <span className="font-medium text-foreground">Plan / status</span> — Taken from the
              extension user record.
            </li>
            <li>
              <span className="font-medium text-foreground">Last session</span> — Latest extension auth
              token row in <code className="text-[10px]">enduser_sessions</code> (one active session per
              user). Falls back to profile created time when none.
            </li>
            <li>
              <span className="font-medium text-foreground">Search</span> — Matches short id, email,
              UUID, name, or installation id (partial, case-insensitive).
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
