"use client"

import { cn } from "@/lib/utils"
import { pad2 } from "@/lib/datetime-local-format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function parseHm(value: string): { hour: number; minute: number } | null {
  if (!value || !value.includes(":")) return null
  const [a, b] = value.split(":").map((x) => parseInt(x, 10))
  const hour = Number.isFinite(a) ? Math.min(23, Math.max(0, a)) : 0
  const minute = Number.isFinite(b) ? Math.min(59, Math.max(0, b)) : 0
  return { hour, minute }
}

function formatHm(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`
}

/** Match {@link @/lib/input-field-surface} h-9; triggers grow equally to fill the row (same visual weight as other fields). */
function triggerTimeClass(extra?: string) {
  return cn(
    "h-9 w-full min-w-0 !rounded-md font-mono tabular-nums",
    "data-[placeholder]:text-foreground/60 dark:data-[placeholder]:text-foreground/65",
    extra
  )
}

export interface TimeSelectProps {
  id?: string
  /** When set, the control is exposed as a group named by that element (use with a visible <Label id={…}>). */
  "aria-labelledby"?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function TimeSelect({ id, "aria-labelledby": ariaLabelledBy, value, onChange, disabled, className }: TimeSelectProps) {
  const parsed = parseHm(value)
  const hour = parsed?.hour ?? null
  const minute = parsed?.minute ?? null

  return (
    <div
      className={cn("flex w-full min-w-0 items-center gap-1.5", className)}
      role={ariaLabelledBy ? "group" : undefined}
      aria-labelledby={ariaLabelledBy}
    >
      <div className="min-w-0 flex-1">
        <Select
          value={hour === null ? undefined : String(hour)}
          onValueChange={(v) => {
            const h = parseInt(v, 10)
            const m = minute ?? 0
            onChange(formatHm(h, m))
          }}
          disabled={disabled}
        >
          <SelectTrigger id={id} className={triggerTimeClass()} aria-label="Hours">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent className="max-h-60 border-input">
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {pad2(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="shrink-0 text-foreground/60" aria-hidden>
        :
      </span>
      <div className="min-w-0 flex-1">
        <Select
          value={minute === null ? undefined : String(minute)}
          onValueChange={(v) => {
            const m = parseInt(v, 10)
            const h = hour ?? 0
            onChange(formatHm(h, m))
          }}
          disabled={disabled}
        >
          <SelectTrigger className={triggerTimeClass()} aria-label="Minutes">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent className="max-h-60 border-input">
            {MINUTES.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {pad2(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
