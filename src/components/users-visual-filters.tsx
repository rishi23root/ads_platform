'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useCloseFilterPanel } from '@/components/filter-panel-context';
import { Button } from '@/components/ui/button';
import { IconX } from '@tabler/icons-react';

/** Mirrors `usersFilterChips()` from `@/lib/end-users-dashboard` (serializable for the client). */
export type UsersActiveFilterChip = {
  id: string;
  urlKeys: string[];
  label: string;
  display: string;
};

type UsersActiveFilterChipsProps = {
  chips: UsersActiveFilterChip[];
};

export function UsersActiveFilterChips({ chips }: UsersActiveFilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const closeFilterPanel = useCloseFilterPanel();

  const removeChip = useCallback(
    (urlKeys: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const k of urlKeys) params.delete(k);
      params.delete('page');
      const qs = params.toString();
      router.push(qs ? `/users?${qs}` : '/users');
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const keys = new Set<string>();
    for (const c of chips) for (const k of c.urlKeys) keys.add(k);
    for (const k of keys) params.delete(k);
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/users?${qs}` : '/users');
    closeFilterPanel?.();
  }, [router, searchParams, chips, closeFilterPanel]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Active filters</p>
        <ul className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.id}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background py-1 pl-2.5 pr-1 text-xs shadow-sm">
                <span className="shrink-0 text-muted-foreground">{c.label}</span>
                <span className="min-w-0 truncate font-medium tabular-nums" title={c.display}>
                  {c.display}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0 rounded-full"
                  onClick={() => removeChip(c.urlKeys)}
                  aria-label={`Remove ${c.label} filter`}
                >
                  <IconX className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {chips.length > 1 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 self-start"
          onClick={clearAll}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
