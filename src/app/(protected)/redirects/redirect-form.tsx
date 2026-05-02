'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Platform, Redirect } from '@/db/schema';
import { findPlatformDomainConflictForRedirect } from '@/lib/redirect-platform-conflict';

interface RedirectFormProps {
  redirect?: Redirect;
  mode: 'create' | 'edit';
  onSuccess?: (saved?: Redirect) => void | Promise<void>;
  onCancel?: () => void;
}

export function RedirectForm({ redirect: redirectRow, mode, onSuccess, onCancel }: RedirectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(redirectRow?.name || '');
  const [sourceDomain, setSourceDomain] = useState(redirectRow?.sourceDomain || '');
  const [includeSubdomains, setIncludeSubdomains] = useState(redirectRow?.includeSubdomains ?? false);
  const [destinationUrl, setDestinationUrl] = useState(redirectRow?.destinationUrl || '');
  const [platformRows, setPlatformRows] = useState<{ domain: string | null }[] | null>(null);
  const [sourceDomainFieldError, setSourceDomainFieldError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/platforms')
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as Platform[];
        return data.map((p) => ({ domain: p.domain }));
      })
      .then((rows) => {
        if (!cancelled) setPlatformRows(rows);
      })
      .catch(() => {
        if (!cancelled) setPlatformRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const extractHostnameFromInput = useCallback((input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    try {
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      return new URL(url).hostname;
    } catch {
      return trimmed;
    }
  }, []);

  const applySourceDomainConflictCheck = (
    host: string,
    includeSubdomainsValue: boolean
  ) => {
    if (!host || !platformRows) {
      setSourceDomainFieldError(null);
      return;
    }
    const hit = findPlatformDomainConflictForRedirect(host, includeSubdomainsValue, platformRows);
    if (hit !== undefined) {
      const msg = `This source domain overlaps a registered site or app (${hit}). Change this redirect or remove the site first.`;
      setSourceDomainFieldError(msg);
      toast.error(msg);
    } else {
      setSourceDomainFieldError(null);
    }
  };

  const handleSourceDomainBlur = () => {
    const extracted = extractHostnameFromInput(sourceDomain);
    if (extracted !== sourceDomain) {
      setSourceDomain(extracted);
    }
    applySourceDomainConflictCheck(extracted, includeSubdomains);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSourceDomainFieldError(null);

    try {
      const url = mode === 'create' ? '/api/redirects' : `/api/redirects/${redirectRow?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sourceDomain,
          includeSubdomains,
          destinationUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : 'Could not save this URL redirect. Please try again.';
        if (response.status === 409) {
          setSourceDomainFieldError(msg);
          return;
        }
        throw new Error(msg);
      }

      toast.success(mode === 'create' ? 'URL redirect created' : 'URL redirect updated');
      if (onSuccess) {
        await onSuccess(data as Redirect);
      } else {
        router.push('/redirects');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this URL redirect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="redirect-name">Name *</Label>
        <Input
          id="redirect-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing site redirect"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-domain">Source domain *</Label>
        <Input
          id="source-domain"
          value={sourceDomain}
          onChange={(e) => {
            setSourceDomain(e.target.value);
            setSourceDomainFieldError(null);
          }}
          onBlur={handleSourceDomainBlur}
          placeholder="example.com"
          required
          disabled={isLoading}
          aria-invalid={sourceDomainFieldError ? true : undefined}
          aria-describedby={
            sourceDomainFieldError ? 'source-domain-error' : 'source-domain-hint'
          }
          className={cn(sourceDomainFieldError && 'border-destructive focus-visible:ring-destructive/30')}
        />
        {sourceDomainFieldError ? (
          <p id="source-domain-error" role="alert" className="text-sm text-destructive">
            {sourceDomainFieldError}
          </p>
        ) : (
          <p id="source-domain-hint" className="text-xs text-muted-foreground">
            The website to match — no http:// or https://. Turn on &quot;Include subdomains&quot; to also match app.example.com, www.example.com, etc.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-input/80 bg-muted/20 px-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="include-subdomains" className="text-sm font-medium">
            Include subdomains
          </Label>
          <p className="text-xs text-muted-foreground">Match app.example.com, www.example.com, etc.</p>
        </div>
        <Switch
          id="include-subdomains"
          checked={includeSubdomains}
          onCheckedChange={(checked) => {
            setIncludeSubdomains(checked);
            const host = extractHostnameFromInput(sourceDomain);
            applySourceDomainConflictCheck(host, checked);
          }}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="destination-url">Destination URL *</Label>
        <Input
          id="destination-url"
          type="url"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="https://destination.example.com/path"
          required
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Enter the full web address starting with <code>https://</code>.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading || !!sourceDomainFieldError}>
          {isLoading ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create URL redirect'
          ) : (
            'Update URL redirect'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push('/redirects'))}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
