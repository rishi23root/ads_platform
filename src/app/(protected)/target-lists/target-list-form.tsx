'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { isoOrDateToLocalDatetimeValue } from '@/lib/datetime-local-format';
import { COUNTRIES } from '@/lib/countries';
import { IconLoader2, IconX, IconUsers, IconFilter } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  isTargetListFilterEmpty,
  summarizeFilter,
  type TargetListFilterJson,
} from '@/lib/target-list-filter';
import { TargetListQualifyingPreview } from '@/components/target-list-qualifying-preview';

type EndUserSearchHit = {
  id: string;
  email: string | null;
  identifier: string | null;
  name: string | null;
};

export type TargetListFormInitial = {
  id: string;
  name: string;
  filterJson: unknown;
  memberIds: string[];
  /** Saved exclusions (edit only); affects live preview. */
  excludedIds?: string[];
};

function parseInitialFilter(raw: unknown): {
  trial: boolean;
  paid: boolean;
  countries: string[];
  banned: 'any' | 'yes' | 'no';
  createdAfter: string;
  createdBefore: string;
} {
  const f = raw as TargetListFilterJson;
  const trial = Boolean(f?.plans?.includes('trial'));
  const paid = Boolean(f?.plans?.includes('paid'));
  const countries = f?.countries ? [...f.countries] : [];
  let banned: 'any' | 'yes' | 'no' = 'any';
  if (f?.banned === true) banned = 'yes';
  else if (f?.banned === false) banned = 'no';
  return {
    trial,
    paid,
    countries,
    banned,
    createdAfter: f?.createdAfter ? isoOrDateToLocalDatetimeValue(f.createdAfter) : '',
    createdBefore: f?.createdBefore ? isoOrDateToLocalDatetimeValue(f.createdBefore) : '',
  };
}

function buildFilterJson(state: {
  trial: boolean;
  paid: boolean;
  countries: string[];
  banned: 'any' | 'yes' | 'no';
  createdAfter: string;
  createdBefore: string;
}): TargetListFilterJson {
  const plans: Array<'trial' | 'paid'> = [];
  if (state.trial) plans.push('trial');
  if (state.paid) plans.push('paid');
  const countries = state.countries.length ? state.countries : undefined;
  const banned =
    state.banned === 'yes' ? true : state.banned === 'no' ? false : undefined;
  const createdAfter = state.createdAfter.trim() || undefined;
  const createdBefore = state.createdBefore.trim() || undefined;
  const raw: NonNullable<TargetListFilterJson> = {};
  if (plans.length) raw.plans = plans;
  if (countries) raw.countries = countries;
  if (typeof banned === 'boolean') raw.banned = banned;
  if (createdAfter) raw.createdAfter = new Date(createdAfter).toISOString();
  if (createdBefore) raw.createdBefore = new Date(createdBefore).toISOString();
  if (isTargetListFilterEmpty(raw)) return null;
  return raw;
}

export function TargetListForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: TargetListFormInitial;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');

  const initF = useMemo(() => parseInitialFilter(initial?.filterJson), [initial?.filterJson]);
  const [planTrial, setPlanTrial] = useState(initF.trial);
  const [planPaid, setPlanPaid] = useState(initF.paid);
  const [countryCodes, setCountryCodes] = useState<string[]>(initF.countries);
  const [banned, setBanned] = useState<'any' | 'yes' | 'no'>(initF.banned);
  const [createdAfter, setCreatedAfter] = useState(initF.createdAfter);
  const [createdBefore, setCreatedBefore] = useState(initF.createdBefore);
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? []);
  const [memberLabels, setMemberLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode !== 'edit' || !initial?.memberIds?.length) return;
    void (async () => {
      const next: Record<string, string> = {};
      for (const uid of initial.memberIds) {
        try {
          const res = await fetch(`/api/end-users/${uid}`);
          const data = await res.json();
          if (res.ok && data.user) {
            const u = data.user as {
              name: string | null;
              email: string | null;
              identifier: string | null;
            };
            next[uid] =
              u.name?.trim() || u.email?.trim() || u.identifier?.trim() || uid.slice(0, 8);
          }
        } catch {
          /* ignore */
        }
      }
      if (Object.keys(next).length) setMemberLabels((prev) => ({ ...prev, ...next }));
    })();
  }, [mode, initial?.id, initial?.memberIds]);

  const [userQuery, setUserQuery] = useState('');
  const [searchHits, setSearchHits] = useState<EndUserSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = userQuery.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const res = await fetch(
            `/api/end-users?q=${encodeURIComponent(q)}&pageSize=20&page=1`
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Search failed');
          const rows = Array.isArray(data.data) ? data.data : [];
          setSearchHits(
            rows.map((r: EndUserSearchHit) => ({
              id: r.id,
              email: r.email,
              identifier: r.identifier,
              name: r.name,
            }))
          );
        } catch {
          setSearchHits([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [userQuery]);

  const filterJson = useMemo(
    () =>
      buildFilterJson({
        trial: planTrial,
        paid: planPaid,
        countries: countryCodes,
        banned,
        createdAfter,
        createdBefore,
      }),
    [planTrial, planPaid, countryCodes, banned, createdAfter, createdBefore]
  );

  const canSubmit = !isTargetListFilterEmpty(filterJson) || memberIds.length > 0;
  const filterSummaryLine = summarizeFilter(filterJson);

  const addMember = useCallback((hit: EndUserSearchHit) => {
    if (memberIds.includes(hit.id)) return;
    setMemberIds((prev) => [...prev, hit.id]);
    const label =
      hit.name?.trim() ||
      hit.email?.trim() ||
      hit.identifier?.trim() ||
      hit.id.slice(0, 8);
    setMemberLabels((prev) => ({ ...prev, [hit.id]: label }));
    setUserQuery('');
    setSearchHits([]);
  }, [memberIds]);

  const removeMember = (id: string) => {
    setMemberIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Give this audience list a name.');
      return;
    }
    if (!canSubmit) {
      toast.error('Add at least one filter, or pick at least one user to include.');
      return;
    }
    setIsLoading(true);
    try {
      const url =
        mode === 'create' ? '/api/target-lists' : `/api/target-lists/${initial?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          filterJson,
          memberIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      toast.success(mode === 'create' ? 'Audience list created' : 'Audience list updated');
      router.push('/target-lists');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsLoading(false);
    }
  };

  const previewExcludedIds = initial?.excludedIds ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
    <Card className="gap-0 py-0 shadow-sm">
      <CardHeader className="border-b bg-muted/20 px-6 pb-5 pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Definition summary</CardTitle>
            <CardDescription className="mt-1.5 max-w-xl text-pretty leading-relaxed">
              Live preview of how this list qualifies users: filter rules and explicit members are
              combined with <span className="text-foreground/80">OR</span> semantics.
            </CardDescription>
          </div>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-background/60 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IconFilter className="h-3.5 w-3.5" aria-hidden />
              Filter segment
            </dt>
            <dd className="mt-2 text-sm font-medium leading-snug text-foreground">
              {filterSummaryLine === '—' ? (
                <span className="font-normal text-muted-foreground">No rules — explicit members only</span>
              ) : (
                filterSummaryLine
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/60 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IconUsers className="h-3.5 w-3.5" aria-hidden />
              Explicit members
            </dt>
            <dd className="mt-2 tabular-nums text-sm font-medium text-foreground">
              {memberIds.length === 0 ? (
                <span className="font-normal text-muted-foreground">None yet</span>
              ) : (
                `${memberIds.length} user${memberIds.length === 1 ? '' : 's'}`
              )}
            </dd>
          </div>
        </dl>
        {!canSubmit ? (
          <p className="mt-3 text-sm text-destructive" role="status">
            Add at least one filter rule or one explicit member to save.
          </p>
        ) : null}
      </CardHeader>

      <form onSubmit={handleSubmit} className="contents">
        <CardContent className="space-y-8 px-6 py-8">
          <div className="space-y-2">
            <Label htmlFor="tl-name" className="text-sm font-medium">
              List name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="max-w-xl"
              placeholder="e.g. India paid — trial cross-sell"
            />
            <p id="tl-name-hint" className="text-xs text-muted-foreground">
              Shown in the admin table and campaign audience picker.
            </p>
          </div>

          <Separator />

          <section className="space-y-4" aria-labelledby="tl-filter-heading">
            <div className="space-y-1">
              <h2 id="tl-filter-heading" className="flex items-center gap-2 text-sm font-semibold">
                <IconFilter className="h-4 w-4 text-muted-foreground" aria-hidden />
                Segment filter
              </h2>
              <p className="max-w-2xl text-pretty text-xs leading-relaxed text-muted-foreground">
                Users who match <strong className="font-medium text-foreground/90">any</strong> of
                these rules qualify, unless you rely solely on explicit members below.
              </p>
            </div>

            <div
              role="group"
              aria-labelledby="tl-plans-label"
              className="space-y-3 rounded-lg border border-input/60 bg-muted/10 p-4"
            >
              <p id="tl-plans-label" className="text-sm font-medium">
                Plans
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id="plan-trial"
                    checked={planTrial}
                    onCheckedChange={(v) => setPlanTrial(v === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="plan-trial" className="cursor-pointer font-normal">
                    Trial
                  </Label>
                </div>
                <div className="flex min-h-8 items-center gap-2">
                  <Checkbox
                    id="plan-paid"
                    checked={planPaid}
                    onCheckedChange={(v) => setPlanPaid(v === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="plan-paid" className="cursor-pointer font-normal">
                    Paid
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tl-banned">Banned status</Label>
                <Select
                  value={banned}
                  onValueChange={(v) => setBanned(v as 'any' | 'yes' | 'no')}
                  disabled={isLoading}
                >
                  <SelectTrigger id="tl-banned" className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="yes">Banned only</SelectItem>
                    <SelectItem value="no">Not banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Countries</Label>
              <p className="text-xs text-muted-foreground">Restrict to selected ISO countries, or leave empty for all.</p>
              <div className="flex min-h-12 flex-wrap gap-2 rounded-lg border border-input/80 bg-muted/15 p-3">
                {countryCodes.map((code) => {
                  const country = COUNTRIES.find((c) => c.code === code);
                  return (
                    <Badge key={code} variant="secondary" className="gap-1 py-1.5 pr-1">
                      {country ? `${country.name} (${code})` : code}
                      <button
                        type="button"
                        onClick={() => setCountryCodes((prev) => prev.filter((c) => c !== code))}
                        className="rounded-full p-0.5 motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove ${country?.name ?? code}`}
                      >
                        <IconX className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (v && !countryCodes.includes(v)) setCountryCodes((prev) => [...prev, v]);
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-8 w-[min(100%,220px)] border-dashed">
                    <SelectValue placeholder="Add country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.filter((c) => !countryCodes.includes(c.code)).map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div className="space-y-2">
                <Label htmlFor="tl-created-after">Created after</Label>
                <p className="text-xs text-muted-foreground">Optional — account created at or after.</p>
                <DateTimePicker
                  id="tl-created-after"
                  value={createdAfter}
                  onChange={setCreatedAfter}
                  disabled={isLoading}
                  allowClear
                  placeholder="Pick date & time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tl-created-before">Created before</Label>
                <p className="text-xs text-muted-foreground">Optional — account created at or before.</p>
                <DateTimePicker
                  id="tl-created-before"
                  value={createdBefore}
                  onChange={setCreatedBefore}
                  disabled={isLoading}
                  allowClear
                  placeholder="Pick date & time"
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4" aria-labelledby="tl-members-heading">
            <div className="space-y-1">
              <h2 id="tl-members-heading" className="flex items-center gap-2 text-sm font-semibold">
                <IconUsers className="h-4 w-4 text-muted-foreground" aria-hidden />
                Explicit members
              </h2>
              <p className="max-w-2xl text-pretty text-xs leading-relaxed text-muted-foreground">
                Pin specific app users by search. They always qualify in addition to anyone who
                matches the filter.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tl-user-search">Search users</Label>
              <Input
                id="tl-user-search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Email, name, or app user ID…"
                disabled={isLoading}
                autoComplete="off"
                className="max-w-xl"
                aria-describedby="tl-user-search-hint"
              />
              <p id="tl-user-search-hint" className="text-xs text-muted-foreground">
                Type at least two characters. Results update after a short pause.
              </p>
              {searchLoading ? (
                <p className="text-xs text-muted-foreground">Searching…</p>
              ) : searchHits.length > 0 ? (
                <ul
                  className="max-h-48 max-w-xl overflow-auto rounded-lg border border-input/80 bg-popover/30 text-sm shadow-sm"
                  role="listbox"
                  aria-label="Search results"
                >
                  {searchHits.map((h) => (
                    <li key={h.id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={memberIds.includes(h.id)}
                        className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2.5 text-left motion-safe:transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => addMember(h)}
                        disabled={memberIds.includes(h.id)}
                      >
                        <span className="min-w-0 truncate">
                          {h.name || h.email || h.identifier || h.id}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {h.id.slice(0, 8)}…
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : userQuery.trim().length >= 2 ? (
                <p className="text-xs text-muted-foreground">No users match that search.</p>
              ) : null}
            </div>

            <div>
              <Label className="mb-2 block text-xs font-medium text-muted-foreground">
                Selected members
              </Label>
              <div className="flex min-h-14 flex-wrap gap-2 rounded-lg border border-input/80 bg-muted/15 p-3">
                {memberIds.length === 0 ? (
                  <p className="w-full py-1 text-sm text-muted-foreground">
                    No one pinned yet — results will rely on the filter only.
                  </p>
                ) : (
                  memberIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1 py-1.5 pr-1">
                      {memberLabels[id] ?? id.slice(0, 8)}
                      <button
                        type="button"
                        onClick={() => removeMember(id)}
                        className="rounded-full p-0.5 motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove ${memberLabels[id] ?? id}`}
                      >
                        <IconX className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </section>
        </CardContent>

        <CardFooter className="flex flex-col-reverse gap-3 border-t bg-muted/15 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" type="button" className="w-full sm:w-auto" disabled={isLoading} asChild>
            <Link href="/target-lists">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full min-h-10 sm:w-auto"
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? 'Create list' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>

    <TargetListQualifyingPreview
      filterJson={filterJson}
      memberIds={memberIds}
      excludedIds={previewExcludedIds}
      pause={isLoading}
      detailHref={mode === 'edit' && initial?.id ? `/target-lists/${initial.id}` : null}
      filterSummaryLine={filterSummaryLine}
    />
    </div>
  );
}
