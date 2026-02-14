'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconFilter } from '@tabler/icons-react';

interface VisitorsFiltersProps {
  visitorId?: string;
  joinedFrom?: string;
  joinedTo?: string;
  lastSeenFrom?: string;
  lastSeenTo?: string;
  country?: string;
  countryOptions: { code: string; name: string }[];
}

export function VisitorsFilters({
  visitorId,
  joinedFrom,
  joinedTo,
  lastSeenFrom,
  lastSeenTo,
  country,
  countryOptions,
}: VisitorsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      params.delete('page'); // Reset to page 1 when filters change
      router.push(`/visitors?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const countryVal = (formData.get('country') as string)?.trim();
    updateFilters({
      visitorId: (formData.get('visitorId') as string)?.trim() || undefined,
      joinedFrom: (formData.get('joinedFrom') as string) || undefined,
      joinedTo: (formData.get('joinedTo') as string) || undefined,
      lastSeenFrom: (formData.get('lastSeenFrom') as string) || undefined,
      lastSeenTo: (formData.get('lastSeenTo') as string) || undefined,
      country: countryVal || undefined,
    });
  };

  const handleClear = () => {
    router.push('/visitors');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFilter className="h-4 w-4" />
          Filters
        </CardTitle>
        <CardDescription>
          Search by visitor ID or filter by date joined, last seen, or country code (e.g. US, IN)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="visitorId">Visitor ID</Label>
            <Input
              id="visitorId"
              name="visitorId"
              type="text"
              placeholder="Search by full or partial ID"
              defaultValue={visitorId}
              className="w-full max-w-md font-mono text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="joinedFrom">Joined from</Label>
              <Input
                id="joinedFrom"
                name="joinedFrom"
                type="datetime-local"
                defaultValue={joinedFrom}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinedTo">Joined to</Label>
              <Input
                id="joinedTo"
                name="joinedTo"
                type="datetime-local"
                defaultValue={joinedTo}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastSeenFrom">Last seen from</Label>
              <Input
                id="lastSeenFrom"
                name="lastSeenFrom"
                type="datetime-local"
                defaultValue={lastSeenFrom}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastSeenTo">Last seen to</Label>
              <Input
                id="lastSeenTo"
                name="lastSeenTo"
                type="datetime-local"
                defaultValue={lastSeenTo}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[180px]">
              <Label htmlFor="country">Country</Label>
              <Select name="country" defaultValue={country ?? ''}>
                <SelectTrigger id="country" className="w-full">
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All countries</SelectItem>
                  {countryOptions.map(({ code, name }) => (
                    <SelectItem key={code} value={code}>
                      {name} ({code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Apply filters</Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
