'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconLoader2, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Ad, Platform } from '@/db/schema';

interface AdFormProps {
  ad?: Ad;
  platforms: Platform[];
  initialPlatformIds?: string[];
  mode: 'create' | 'edit';
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
];

export function AdForm({ ad, platforms, initialPlatformIds = [], mode }: AdFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(ad?.name || '');
  const [description, setDescription] = useState(ad?.description || '');
  const [imageUrl, setImageUrl] = useState(ad?.imageUrl || '');
  const [targetUrl, setTargetUrl] = useState(ad?.targetUrl || '');
  const [platformIds, setPlatformIds] = useState<string[]>(initialPlatformIds);
  const [status, setStatus] = useState(ad?.status || 'inactive');
  const [startDate, setStartDate] = useState(
    ad?.startDate ? new Date(ad.startDate).toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    ad?.endDate ? new Date(ad.endDate).toISOString().split('T')[0] : ''
  );
  const [imagePreviewError, setImagePreviewError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/ads' : `/api/ads/${ad?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          imageUrl,
          targetUrl,
          platformIds,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save ad');
      }

      toast.success(mode === 'create' ? 'Ad created successfully' : 'Ad updated successfully');
      router.push('/ads');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save ad');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create Ad' : 'Edit Ad'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad name"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            {imageUrl.trim() && (
              <div className="rounded-md border border-input bg-muted/30 overflow-hidden flex items-center justify-center min-h-[120px] max-h-[200px] aspect-video w-full max-w-sm">
                {imagePreviewError ? (
                  <p className="text-sm text-muted-foreground px-4 text-center">
                    Could not load image. Check the URL.
                  </p>
                ) : (
                  <img
                    key={imageUrl}
                    src={imageUrl.trim()}
                    alt="Preview"
                    className="max-h-[200px] w-auto object-contain"
                    onError={() => setImagePreviewError(true)}
                    onLoad={() => setImagePreviewError(false)}
                  />
                )}
              </div>
            )}
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImagePreviewError(false);
              }}
              placeholder="https://example.com/image.jpg"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetUrl">Target URL</Label>
            <Input
              id="targetUrl"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <p className="text-sm text-muted-foreground">
              Add one or more platforms where this ad should be visible
            </p>
            <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-10">
              {platformIds.map((id) => {
                const platform = platforms.find((p) => p.id === id);
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1 pr-1 font-normal"
                  >
                    {platform?.name ?? id}
                    <button
                      type="button"
                      onClick={() => setPlatformIds((prev) => prev.filter((pid) => pid !== id))}
                      disabled={isLoading}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      aria-label={`Remove ${platform?.name ?? id}`}
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              <Select
                key={platformIds.join(',')}
                value=""
                onValueChange={(value) => {
                  if (value && !platformIds.includes(value)) {
                    setPlatformIds((prev) => [...prev, value]);
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="w-[180px] border-0 shadow-none focus:ring-0 h-8 bg-transparent">
                  <SelectValue placeholder="Add platform..." />
                </SelectTrigger>
                <SelectContent>
                  {platforms
                    .filter((p) => !platformIds.includes(p.id))
                    .map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  {platforms.filter((p) => !platformIds.includes(p.id)).length === 0 && (
                    <span className="px-2 py-1.5 text-sm text-muted-foreground">
                      All platforms added
                    </span>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                When the ad should start
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                When the ad should end (auto-expires after this date)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                mode === 'create' ? 'Create Ad' : 'Update Ad'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/ads')}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
