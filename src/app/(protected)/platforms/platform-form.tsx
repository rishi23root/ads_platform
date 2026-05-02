'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Platform, Redirect } from '@/db/schema';
import { findRedirectConflictForPlatform } from '@/lib/redirect-platform-conflict';

interface PlatformFormProps {
  platform?: Platform;
  mode: 'create' | 'edit';
  /** When provided, called on success instead of navigating (e.g. drawer mode). In create mode, receives the new platform. */
  onSuccess?: (saved?: Platform) => void | Promise<void>;
  /** When provided, called on Cancel instead of navigating (e.g. drawer mode) */
  onCancel?: () => void;
}

export function PlatformForm({ platform, mode, onSuccess, onCancel }: PlatformFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(platform?.name || '');
  const [domain, setDomain] = useState(platform?.domain || '');
  const [redirectRules, setRedirectRules] = useState<
    { sourceDomain: string; includeSubdomains: boolean }[] | null
  >(null);
  const [domainFieldError, setDomainFieldError] = useState<string | null>(null);
  const [nameFieldError, setNameFieldError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/redirects')
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as (Redirect & { linkedCampaignCount?: number })[];
        return data.map((r) => ({
          sourceDomain: r.sourceDomain,
          includeSubdomains: r.includeSubdomains,
        }));
      })
      .then((rows) => {
        if (!cancelled) setRedirectRules(rows);
      })
      .catch(() => {
        if (!cancelled) setRedirectRules([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const extractDomainFromInput = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';

    try {
      // If it looks like a URL, extract hostname
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      return new URL(url).hostname;
    } catch {
      // If not a valid URL, assume it's already a domain
      return trimmed;
    }
  };

  const handleDomainBlur = () => {
    const extracted = extractDomainFromInput(domain);
    if (extracted !== domain) {
      setDomain(extracted);
    }
    if (!extracted || !redirectRules) {
      setDomainFieldError(null);
      return;
    }
    const hit = findRedirectConflictForPlatform(extracted, redirectRules);
    if (hit !== undefined) {
      const msg = `This domain is already covered by a URL redirect (source: ${hit.sourceDomain}). Change or remove the redirect first.`;
      setDomainFieldError(msg);
      toast.error(msg);
    } else {
      setDomainFieldError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setDomainFieldError(null);
    setNameFieldError(null);

    try {
      const url = mode === 'create' ? '/api/platforms' : `/api/platforms/${platform?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : 'Could not save this site or app. Please try again.';
        if (response.status === 409) {
          if (msg.includes('name already exists')) {
            setNameFieldError(msg);
          } else {
            setDomainFieldError(msg);
          }
          return;
        }
        throw new Error(msg);
      }

      toast.success(mode === 'create' ? 'Site or app added' : 'Site or app updated');
      if (onSuccess) {
        await onSuccess(data as Platform);
      } else {
        router.push('/platforms');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this site or app. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameFieldError(null);
          }}
          placeholder="e.g. Instagram web"
          required
          disabled={isLoading}
          aria-invalid={nameFieldError ? true : undefined}
          aria-describedby={nameFieldError ? 'platform-name-error' : undefined}
          className={cn(nameFieldError && 'border-destructive focus-visible:ring-destructive/30')}
        />
        {nameFieldError ? (
          <p id="platform-name-error" role="alert" className="text-sm text-destructive">
            {nameFieldError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="domain">Domain *</Label>
        <Input
          id="domain"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setDomainFieldError(null);
          }}
          onBlur={handleDomainBlur}
          placeholder="example.com or https://www.example.com"
          required
          disabled={isLoading}
          aria-invalid={domainFieldError ? true : undefined}
          aria-describedby={
            domainFieldError ? 'platform-domain-error' : 'platform-domain-hint'
          }
          className={cn(domainFieldError && 'border-destructive focus-visible:ring-destructive/30')}
        />
        {domainFieldError ? (
          <p id="platform-domain-error" role="alert" className="text-sm text-destructive">
            {domainFieldError}
          </p>
        ) : (
          <p id="platform-domain-hint" className="text-sm text-muted-foreground">
            Enter a website address like <code>instagram.com</code> or <code>www.instagram.com</code>. You can paste a full URL and we&apos;ll pick out the domain.
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          type="submit"
          disabled={isLoading || !!domainFieldError || !!nameFieldError}
        >
          {isLoading ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating...' : 'Updating...'}
            </>
          ) : (
            mode === 'create' ? 'Save' : 'Update'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push('/platforms'))}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
