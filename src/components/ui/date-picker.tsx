"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { inputFieldSurfaceClassName } from "@/lib/input-field-surface"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface DatePickerProps {
  id?: string
  /** `YYYY-MM-DD` or empty */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  allowClear?: boolean
}

function parseYmd(value: string): Date | undefined {
  const s = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function DatePicker({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Pick date",
  className,
  allowClear = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [timeZone, setTimeZone] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  const date = React.useMemo(() => {
    if (!value.trim()) return undefined
    const ymd = parseYmd(value)
    if (ymd) return ymd
    const d = new Date(value.trim())
    if (Number.isNaN(d.getTime())) return undefined
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [value])

  const displayLabel = React.useMemo(() => {
    if (!date) return null
    try {
      return format(date, "MMM d, yyyy")
    } catch {
      return value.trim() || null
    }
  }, [date, value])

  const hasValue = Boolean(displayLabel)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={inputFieldSurfaceClassName(
            cn(
              "inline-flex cursor-pointer items-center gap-2 text-left font-normal",
              hasValue ? "text-foreground" : "text-muted-foreground",
              className
            )
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{displayLabel ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={date}
            timeZone={timeZone}
            defaultMonth={date ?? new Date()}
            onSelect={(d) => {
              if (!d) return
              onChange(toYmd(d))
              setOpen(false)
            }}
            initialFocus
          />
        </div>
        {allowClear && hasValue ? (
          <div className="border-t px-3 py-2">
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
              disabled={disabled}
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
