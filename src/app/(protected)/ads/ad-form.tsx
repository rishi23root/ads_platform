'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Ad } from '@/db/schema';

interface AdFormProps {
  ad?: Ad;
  mode: 'create' | 'edit';
  /** When provided, called on success instead of navigating. Create passes adId, edit passes nothing. */
  onSuccess?: (adId?: string) => void | Promise<void>;
  /** When provided, called on Cancel instead of navigating (e.g. to close drawer) */
  onCancel?: () => void;
}

export function AdForm({ ad, mode, onSuccess, onCancel }: AdFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(ad?.name || '');
  const [description, setDescription] = useState(ad?.description || '');
  const [imageUrl, setImageUrl] = useState(ad?.imageUrl || '');
  const [targetUrl, setTargetUrl] = useState(ad?.targetUrl || '');
  const [htmlCode, setHtmlCode] = useState(ad?.htmlCode ?? '');
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
          htmlCode: htmlCode || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save ad');
      }

      toast.success(mode === 'create' ? 'Ad created successfully' : 'Ad updated successfully');
      if (onSuccess) {
        await onSuccess(mode === 'create' ? data?.id : undefined);
      } else {
        router.push('/ads');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save ad');
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
              <div className="relative w-full h-full min-h-[120px]">
                <Image
                  key={imageUrl}
                  src={imageUrl.trim()}
                  alt="Preview"
                  fill
                  className="object-contain"
                  unoptimized
                  onError={() => setImagePreviewError(true)}
                  onLoad={() => setImagePreviewError(false)}
                />
              </div>
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
        <Label htmlFor="htmlCode">HTML code (for page integration)</Label>
        <Textarea
          id="htmlCode"
          value={htmlCode}
          onChange={(e) => setHtmlCode(e.target.value)}
          placeholder="Optional HTML snippet to inject"
          rows={4}
          disabled={isLoading}
          className="font-mono text-sm"
        />
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
          onClick={() => (onCancel ? onCancel() : router.push('/ads'))}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
