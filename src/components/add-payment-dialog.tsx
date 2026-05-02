"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { IconLoader2, IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"

interface AddPaymentDialogProps {
  userId: string
  onCreated?: () => void
}

export function AddPaymentDialog({ userId, onCreated }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [amountDollars, setAmountDollars] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | "refunded">("completed")
  const [description, setDescription] = useState("")
  const [accessEndLocal, setAccessEndLocal] = useState("")
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setAmountDollars("")
    setCurrency("USD")
    setStatus("completed")
    setDescription("")
    setAccessEndLocal("")
  }

  function accessEndToIso(localValue: string): string | undefined {
    if (!localValue.trim()) return undefined
    const d = new Date(localValue)
    if (Number.isNaN(d.getTime())) return undefined
    return d.toISOString()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amountDollars)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    const cents = Math.round(parsed * 100)
    setLoading(true)
    try {
      const res = await fetch(`/api/end-users/${userId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cents,
          currency,
          status,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(accessEndToIso(accessEndLocal) ? { endDate: accessEndToIso(accessEndLocal) } : {}),
        }),
      })
      if (!res.ok) {
        const j = (await res.json()) as { error?: string }
        toast.error(j.error ?? "Could not add payment")
        return
      }
      toast.success("Payment added")
      setOpen(false)
      reset()
      onCreated?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <IconPlus className="h-4 w-4" />
          Add payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add payment</DialogTitle>
            <DialogDescription>
              Record a payment for this app user (manual bookkeeping).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (dollars)</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessEnd">Access end (optional)</Label>
              <DateTimePicker
                id="accessEnd"
                value={accessEndLocal}
                onChange={setAccessEndLocal}
                disabled={loading}
                allowClear
                placeholder="Pick access end"
              />
              <p className="text-xs leading-relaxed text-foreground/70 dark:text-foreground/65">
                If set, updates this user&apos;s subscription end date on their profile.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
