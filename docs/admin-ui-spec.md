# Admin dashboard UI specification

This document is the single source of truth for layout, surfaces, typography, and data tables in the protected admin app. It reflects [shadcn/ui](https://ui.shadcn.com/) patterns (card, table, sidebar) and dense admin conventions (clear hierarchy, consistent table chrome, accessible focus states).

## Design tokens

Semantic colors live in [`src/app/globals.css`](../src/app/globals.css) (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, chart tokens, etc.). Prefer these via Tailwind (`bg-card`, `text-muted-foreground`, `border-border`) rather than one-off hex values.

### Surfaces (mental model)

| Role | Usage |
|------|--------|
| **App background** | `--background` — page canvas behind the main column. |
| **Raised panel / card** | `--card` with optional opacity (e.g. `bg-card/40`) for metric and chart strips. |
| **Muted band** | `--muted` — toolbars, table footers, filter chips background. |
| **Data table shell** | [`DataTableSurface`](../src/components/ui/data-table-surface.tsx) — consistent border, radius, and elevation for tabular content. |

### Semantic trend / status colors

- **Positive delta / success emphasis**: `text-emerald-600 dark:text-emerald-400` (and matching `bg-emerald-500/10` for badges). Use consistently for “up” trends and completed-positive states.
- **Negative delta**: `text-red-600 dark:text-red-400` with `bg-red-500/10` badges where needed.
- **Warning / destructive**: `amber` and `destructive` from the theme for confirmations and errors.

Avoid mixing `green-500` and `emerald` for the same meaning in one screen.

## Layout

### Page shell

- **Padding**: `p-4 md:p-6` on the main scroll column.
- **Vertical rhythm**: default stack gap **`gap-6`** between major sections. Use `gap-4` only for tight toolbars or filter rows. Account and long forms may use `gap-8` between distant sections.
- **Constrained forms**: create/edit flows use `mx-auto max-w-5xl` or `max-w-7xl` depending on complexity; keep page padding and align inner `Card` to the same horizontal rhythm.

### Page header

Use [`PageHeader`](../src/components/page-header.tsx) for list and settings pages:

- **Title**: `text-2xl font-semibold tracking-tight`.
- **Description**: `text-sm text-muted-foreground leading-relaxed` (single scale app-wide).
- **Actions**: primary buttons aligned to the end on `sm+` breakpoints.

Optional: `titleClassName` for pages that need a slightly smaller title on mobile (e.g. `text-xl md:text-2xl` on filter-heavy screens).

## Data tables

### `DataTableSurface`

All primary list tables should sit inside [`DataTableSurface`](../src/components/ui/data-table-surface.tsx).

| Variant | When to use |
|---------|-------------|
| **`default`** | Standard admin lists: Users, Events, Payments, content libraries (Ads, Platforms, Notifications, Redirects), Members. |
| **`delivery`** | Pipeline / delivery context: Campaigns list, Target lists list. Adds a subtle **primary left border** so these tables read as “delivery” without changing density or typography. |
| **`embedded`** | Dashboard sections (e.g. “Recent campaigns”) — softer shadow, `rounded-xl`, `bg-card/40`. |

Do not mix ad-hoc `rounded-md border bg-background` and `rounded-lg … bg-card/30` for the same role; use the component.

### Table content

- Use shared [`Table`](../src/components/ui/table.tsx) primitives; row hover and borders come from the primitive.
- **Header density**: either default `TableHead` (medium) or, for log-style screens, `text-muted-foreground text-xs font-normal` consistently within that page.
- **Empty states**: dashed border + centered message for “create first” (see target lists); simple `py-8 text-center text-muted-foreground` inside the surface for “no rows / no matches.”

## Optional nav-zone accents (sidebar)

Sidebar groups are defined in [`app-sidebar.tsx`](../src/components/app-sidebar.tsx): Overview, Delivery, Content, Team.

**Table differentiation** is expressed through `DataTableSurface` variants (`delivery` vs `default`), not through different table densities per zone. Future work could add a subtle nav accent (e.g. section color in the sidebar) without changing table components.

## Route inventory (protected)

| Route | Page shell | Primary surface(s) | Table / main UI | Notes |
|-------|------------|-------------------|-----------------|-------|
| `/` | `gap-6 p-4 md:p-6` | Section cards + chart + `DataTableSurface` embedded | Recent campaigns | KPI cards use `Card` + `bg-card/40`. |
| `/users` | `UsersPageLayout` | Filters + `DataTableSurface` default | Extension users table | Section heading + toolbar. |
| `/users/[id]` | `px-4 py-4 md:px-6` | Detail client components | Profile + payments embedded table | Full-width detail. |
| `/events` | `EventsPageLayout` | `DataTableSurface` default | Event log table | |
| `/campaigns` | `gap-4 p-4 md:p-6` | `PageHeader` + `DataTableSurface` delivery | `CampaignsListTable` | |
| `/campaigns/new` | `max-w-*` centered | Form `Card` | — | |
| `/campaigns/[id]` | — | `CampaignDashboard` | KPI blocks, tabs, logs | Client dashboard. |
| `/campaigns/[id]/edit` | `max-w-*` centered | Form | — | |
| `/target-lists` | `gap-4 p-4 md:p-6` | Header + `DataTableSurface` delivery | `TargetListsTable` | |
| `/target-lists/new` | `max-w-7xl` | Form | — | |
| `/target-lists/[id]` | `gap-6 p-4 md:p-6` | Detail card `rounded-xl` + shadow | Members sub-table | Hero card stronger than list tables. |
| `/target-lists/[id]/edit` | `max-w-7xl` | Form | — | |
| `/platforms` | Table component only | `PageHeader` + `DataTableSurface` default | Drawer table | Consider lifting shell to `page.tsx` later. |
| `/platforms/new`, `[id]/edit` | `max-w-5xl` | `Card` form | — | |
| `/ads` | Table component only | Same as platforms | — | |
| `/ads/new`, `[id]/edit` | `max-w-5xl` | `Card` form | — | |
| `/notifications` | Table component only | Same | — | |
| `/notifications/new`, `[id]/edit` | `max-w-5xl` | `Card` form | — | |
| `/redirects` | Table component only | Same | — | |
| `/redirects/new`, `[id]/edit` | `max-w-5xl` | `Card` form | — | |
| `/members` | `gap-4 p-4 md:p-6` | `PageHeader` + `DataTableSurface` default | `MembersTable` | Admin-only. |
| `/payments` | `PaymentsPageLayout` | `KpiCard` row + `DataTableSurface` default | `AllPaymentsTable` | |
| `/account` | `max-w-6xl gap-8` | `Card` sections | — | Wider gap between sections. |

## References

- [shadcn/ui documentation](https://ui.shadcn.com/docs) — Card, Table, Sidebar.
- [Refactoring UI](https://refactoringui.com/) — spacing, hierarchy, and label contrast (general principles).
