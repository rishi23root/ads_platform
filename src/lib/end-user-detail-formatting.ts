/** Shared display helpers for the app user (extension end user) detail UI. */
export const END_USER_DISPLAY_LOCALE = "en-US" as const

export function formatEndUserWhen(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(END_USER_DISPLAY_LOCALE, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return "—"
  }
}

export function formatEndUserMoneyCents(cents: number, currency: string) {
  return new Intl.NumberFormat(END_USER_DISPLAY_LOCALE, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100)
}
