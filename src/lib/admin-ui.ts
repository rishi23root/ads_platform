/**
 * Shared layout / chrome classes for admin surfaces (see docs/admin-ui-spec.md).
 * Centralizing reduces duplication and keeps lint/build work proportional to real edits.
 */

/** Profile, account, and user-detail bento panels */
export const adminPanelCardClassName =
  'overflow-hidden rounded-xl border border-border bg-card/40 shadow-none' as const

/** Standard data table column header (log-style / dense lists) */
export const dataTableHeadMutedClassName =
  'text-muted-foreground text-xs font-normal' as const
