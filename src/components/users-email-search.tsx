'use client';

import { IconX } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Idle delay after typing before syncing URL (and refetching the list). */
const DEBOUNCE_MS = 500;

export function UsersEmailSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') ?? '';
  const [value, setValue] = useState(emailFromUrl);
  const searchParamsRef = useRef(searchParams);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    setValue(emailFromUrl);
  }, [emailFromUrl]);

  const clearEmail = useCallback(() => {
    setValue('');
    const params = new URLSearchParams(searchParamsRef.current.toString());
    params.delete('email');
    params.delete('page');
    const next = params.toString();
    router.push(next ? `/users?${next}` : '/users');
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = value.trim();
      const params = searchParamsRef.current;
      const emailInUrl = (params.get('email') ?? '').trim();
      if (trimmed === emailInUrl) return;

      const nextParams = new URLSearchParams(params.toString());
      if (trimmed) nextParams.set('email', trimmed);
      else nextParams.delete('email');
      nextParams.delete('page');
      const next = nextParams.toString();
      router.push(next ? `/users?${next}` : '/users');
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, router]);

  const showClear = value.trim().length > 0;

  return (
    <div className="relative min-w-0 max-w-md">
      <label htmlFor="users-email-search" className="sr-only">
        Search users by email
      </label>
      <Input
        id="users-email-search"
        type="text"
        placeholder="Search by email…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        className={showClear ? 'w-full pr-10' : 'w-full'}
      />
      {showClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
          onClick={clearEmail}
          aria-label="Clear email search"
        >
          <IconX className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
