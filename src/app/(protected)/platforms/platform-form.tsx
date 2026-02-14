'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Platform } from '@/db/schema';

interface PlatformFormProps {
  platform?: Platform;
  mode: 'create' | 'edit';
  /** When provided, called on success instead of navigating (e.g. drawer mode) */
  onSuccess?: () => void | Promise<void>;
  /** When provided, called on Cancel instead of navigating (e.g. drawer mode) */
  onCancel?: () => void;
}

export function PlatformForm({ platform, mode, onSuccess, onCancel }: PlatformFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(platform?.name || '');
  const [domain, setDomain] = useState(platform?.domain || '');
  const [isActive, setIsActive] = useState(platform?.isActive ?? true);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/platforms' : `/api/platforms/${platform?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain, isActive }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save platform');
      }

      toast.success(mode === 'create' ? 'Platform created successfully' : 'Platform updated successfully');
      if (onSuccess) {
        await onSuccess();
      } else {
        router.push('/platforms');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save platform');
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
          onChange={(e) => setName(e.target.value)}
          placeholder="Platform name"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="domain">Domain *</Label>
        <Input
          id="domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onBlur={handleDomainBlur}
          placeholder="example.com or https://www.example.com"
          required
          disabled={isLoading}
        />
        <p className="text-sm text-muted-foreground">
          Enter domain or subdomain (e.g., instagram.com, www.instagram.com). Full URLs will be automatically extracted.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isLoading}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
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
