import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
import { database as db } from '@/db';
import { targetLists } from '@/db/schema';
import { Badge } from '@/components/ui/badge';
import { HumanReadableDate } from '@/components/human-readable-date';
import { TablePagination } from '@/components/ui/table-pagination';
import { TargetListMembersTable } from '@/components/target-list-members-table';
import { TargetListDetailAdminActions } from '@/components/target-list-detail-admin-actions';
import { TargetListLinkedCampaigns } from '@/components/target-list-linked-campaigns';
import { fetchCampaignsForTargetList } from '@/lib/target-list-queries';
import {
  isTargetListFilterEmpty,
  type TargetListFilterJson,
} from '@/lib/target-list-filter';
import {
  aggregateTargetListMemberBreakdown,
  countTargetListMembersByTab,
  listTargetListMembers,
  type TargetListMemberTabSource,
} from '@/lib/target-list-members-query';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; page?: string }>;
};

function parseSource(raw: string | undefined): TargetListMemberTabSource {
  if (raw === 'explicit' || raw === 'filter' || raw === 'excluded') return raw;
  return 'all';
}

function filterBadges(f: TargetListFilterJson): string[] {
  if (!f || isTargetListFilterEmpty(f)) return [];
  const out: string[] = [];
  if (f.plans?.length) out.push(`Plan: ${f.plans.join(', ')}`);
  if (f.countries?.length) out.push(`Country: ${f.countries.join(', ')}`);
  if (typeof f.banned === 'boolean') out.push(`Banned: ${f.banned ? 'yes' : 'no'}`);
  if (f.createdAfter) out.push(`Created after: ${f.createdAfter.slice(0, 10)}`);
  if (f.createdBefore) out.push(`Created before: ${f.createdBefore.slice(0, 10)}`);
  return out;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const s = await getSessionWithRole();
  if (!s) return { title: 'Target list' };
  const { id } = await params;
  const [row] = await db.select({ name: targetLists.name }).from(targetLists).where(eq(targetLists.id, id)).limit(1);
  return { title: row ? row.name : 'Target list' };
}

export default async function TargetListDetailPage({ params, searchParams }: PageProps) {
  const s = await getSessionWithRole();
  if (!s) redirect('/login');

  const { id } = await params;
  const sp = await searchParams;
  const source = parseSource(sp.source);
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const pageSize = 25;

  const [row] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
  if (!row) notFound();

  const listIn = {
    id: row.id,
    memberIds: [...(row.memberIds ?? [])],
    excludedIds: [...(row.excludedIds ?? [])],
    filterJson: row.filterJson,
  };

  const [linkedCampaigns, tabCounts, breakdown, members] = await Promise.all([
    fetchCampaignsForTargetList(id),
    countTargetListMembersByTab(listIn),
    aggregateTargetListMemberBreakdown(listIn),
    listTargetListMembers(listIn, { source, page, pageSize }),
  ]);

  const campaignsUsing = linkedCampaigns.length;
  const isAdmin = s.role === 'admin';
  const filterJson = row.filterJson as TargetListFilterJson;
  const chips = filterBadges(filterJson);
  const totalForSource =
    source === 'all'
      ? tabCounts.all
      : source === 'explicit'
        ? tabCounts.explicit
        : source === 'filter'
          ? tabCounts.filter
          : tabCounts.excluded;
  const totalPages = Math.ceil(totalForSource / pageSize) || 1;

  const tabDefs: { key: TargetListMemberTabSource; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'explicit', label: 'Explicit' },
    { key: 'filter', label: 'Filter' },
    { key: 'excluded', label: 'Excluded' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ── Overview card ── */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        {/* Title bar */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <h1 className="min-w-0 text-pretty text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
            {row.name}
          </h1>
          {isAdmin ? (
            <TargetListDetailAdminActions
              listId={row.id}
              listName={row.name}
              campaignsUsing={campaignsUsing}
              compact
            />
          ) : null}
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
          {/* Left: stats + meta */}
          <div className="flex flex-col gap-5 px-5 py-5">
            {/* Key numbers */}
            <dl className="grid grid-cols-3 gap-3">
              {(
                [
                  { label: 'Members', value: tabCounts.all },
                  { label: 'Excluded', value: tabCounts.excluded },
                  { label: 'Campaigns', value: campaignsUsing },
                ] as const
              ).map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-3"
                >
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums leading-none text-foreground">
                    {value.toLocaleString('en-US')}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Definition */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Filter definition
              </p>
              <div className="flex flex-wrap gap-1.5">
                {chips.length === 0 ? (
                  <Badge variant="secondary" className="font-normal">
                    No filter — explicit members only
                  </Badge>
                ) : (
                  chips.map((c) => (
                    <Badge key={c} variant="secondary" className="font-normal">
                      {c}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Member mix */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Member mix
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {breakdown.plans.paid.toLocaleString('en-US')}
                  </span>{' '}
                  paid
                </span>
                <span className="text-border" aria-hidden>·</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {breakdown.plans.trial.toLocaleString('en-US')}
                  </span>{' '}
                  trial
                </span>
                {breakdown.topCountries.length > 0 ? (
                  <>
                    <span className="hidden text-border sm:inline" aria-hidden>·</span>
                    <div className="flex flex-wrap gap-1.5">
                      {breakdown.topCountries.map((c) => (
                        <Badge key={c.country} variant="outline" className="font-normal tabular-nums">
                          {c.country} {c.count.toLocaleString('en-US')}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Timestamps */}
            <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
              Created <HumanReadableDate date={row.createdAt} />
              {' · '}
              Updated <HumanReadableDate date={row.updatedAt} />
            </p>
          </div>

          {/* Right: connected campaigns */}
          <TargetListLinkedCampaigns
            campaigns={linkedCampaigns}
            className="border-t border-border/60 lg:border-l lg:border-t-0"
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <nav
        className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-1"
        aria-label="Member segments"
      >
        {tabDefs.map((t) => {
          const count =
            t.key === 'all'
              ? tabCounts.all
              : t.key === 'explicit'
                ? tabCounts.explicit
                : t.key === 'filter'
                  ? tabCounts.filter
                  : tabCounts.excluded;
          const active = source === t.key;
          const href = `/target-lists/${id}?source=${t.key}&page=1`;
          return (
            <Link
              key={t.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium motion-safe:transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              )}
            >
              {t.label}
              <span
                className={cn(
                  'tabular-nums',
                  active ? 'text-muted-foreground' : 'text-muted-foreground/60'
                )}
              >
                {count.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </nav>

      {totalForSource > 0 ? (
        <TablePagination
          mode="link"
          page={page}
          totalPages={totalPages}
          totalCount={totalForSource}
          pageSize={pageSize}
          basePath={`/target-lists/${id}`}
          filterParams={{ source }}
        />
      ) : null}

      <TargetListMembersTable listId={id} source={source} rows={members} isAdmin={isAdmin} />
    </div>
  );
}
