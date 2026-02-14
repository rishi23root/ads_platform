'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Notification } from '@/db/schema';

interface NotificationFormProps {
  notification?: Notification;
  mode: 'create' | 'edit';
  /** When provided, called on success instead of navigating. Create passes notificationId, edit passes nothing. */
  onSuccess?: (notificationId?: string) => void | Promise<void>;
  /** When provided, called on Cancel instead of navigating (e.g. to close drawer) */
  onCancel?: () => void;
}

export function NotificationForm({ notification, mode, onSuccess, onCancel }: NotificationFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState(notification?.title || '');
  const [message, setMessage] = useState(notification?.message || '');
  const [ctaLink, setCtaLink] = useState(notification?.ctaLink ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/notifications' : `/api/notifications/${notification?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          ctaLink: ctaLink || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save notification');
      }

      toast.success(mode === 'create' ? 'Notification created successfully' : 'Notification updated successfully');
      if (onSuccess) {
        await onSuccess(mode === 'create' ? data?.id : undefined);
      } else {
        router.push('/notifications');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notification message"
          rows={4}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ctaLink">CTA link</Label>
        <Input
          id="ctaLink"
          type="url"
          value={ctaLink}
          onChange={(e) => setCtaLink(e.target.value)}
          placeholder="https://example.com"
          disabled={isLoading}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            mode === 'create' ? 'Create Notification' : 'Update Notification'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push('/notifications'))}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
