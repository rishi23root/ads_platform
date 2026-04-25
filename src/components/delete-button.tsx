'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { IconTrash, IconLoader2, IconBan, IconAlertTriangle } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LinkedCampaigns } from '@/components/linked-campaigns';

const entityLabels = {
  ad: {
    title: 'Delete Ad',
    successMessage: 'Ad deleted successfully',
    errorMessage: 'Failed to delete ad',
  },
  platform: {
    title: 'Delete Platform',
    successMessage: 'Platform deleted successfully',
    errorMessage: 'Failed to delete platform',
  },
  notification: {
    title: 'Delete Notification',
    successMessage: 'Notification deleted successfully',
    errorMessage: 'Failed to delete notification',
  },
  redirect: {
    title: 'Delete Redirect',
    successMessage: 'Redirect deleted successfully',
    errorMessage: 'Failed to delete redirect',
  },
  campaign: {
    title: 'Delete Campaign',
    successMessage: 'Campaign removed from delivery. History and logs are kept.',
    errorMessage: 'Failed to delete campaign',
  },
} as const;

const campaignDualDialogCopy = {
  title: 'Remove or permanently delete campaign?',
    permanentSuccess: 'Campaign and all related activity were permanently removed.',
  permanentError: 'Failed to permanently delete campaign',
} as const;

type EntityType = keyof typeof entityLabels;

export type LinkedDeleteHelpType = 'ad' | 'notification' | 'redirect' | 'platform';

type DeleteButtonProps = {
  name: string;
  apiPath: string;
  /** When provided, redirects here after successful delete (e.g. when deleting from a detail page) */
  redirectTo?: string;
} & (
  | { entityType: 'campaign'; campaignStatus: string }
  | {
      entityType: Exclude<EntityType, 'campaign'>;
      /** When true, delete is blocked (e.g. content linked to campaigns). */
      disabled?: boolean;
      /** Shown in a tooltip when `disabled` is true. */
      disabledReason?: string;
      /** When delete is blocked, lists campaigns and explains next steps (popover + links). */
      linkedHelp?: { type: LinkedDeleteHelpType; entityId: string };
    }
);

const contentDeleteTriggerClass =
  'text-destructive hover:text-destructive hover:bg-destructive/10';

function deleteRequestUrl(apiPath: string, permanent: boolean): string {
  if (!permanent) return apiPath;
  return apiPath.includes('?') ? `${apiPath}&permanent=1` : `${apiPath}?permanent=1`;
}

function CampaignAdminDeleteButton({
  name,
  apiPath,
  redirectTo,
  campaignStatus,
}: {
  name: string;
  apiPath: string;
  redirectTo?: string;
  campaignStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<'soft' | 'permanent' | null>(null);
  const [mounted, setMounted] = useState(false);
  const isAlreadySoftDeleted = campaignStatus === 'deleted';

  useEffect(() => setMounted(true), []);

  const finishSuccess = () => {
    setOpen(false);
    if (redirectTo) {
      router.replace(redirectTo);
    } else {
      router.refresh();
    }
  };

  const runDelete = async (permanent: boolean) => {
    setDeleting(permanent ? 'permanent' : 'soft');
    try {
      const response = await fetch(deleteRequestUrl(apiPath, permanent), { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) ||
            (permanent ? campaignDualDialogCopy.permanentError : entityLabels.campaign.errorMessage)
        );
      }

      if (permanent) {
        toast.success(campaignDualDialogCopy.permanentSuccess);
      } else if (data.alreadySoftDeleted) {
        toast.message('This campaign was already removed from delivery.');
      } else {
        toast.success(entityLabels.campaign.successMessage);
      }

      finishSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : permanent
            ? campaignDualDialogCopy.permanentError
            : entityLabels.campaign.errorMessage
      );
    } finally {
      setDeleting(null);
    }
  };

  const triggerClassName =
    'min-h-10 min-w-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/25';

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={triggerClassName} disabled tabIndex={-1}>
        <IconTrash className="h-4 w-4" aria-hidden />
        <span className="sr-only">Delete campaign</span>
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName}
          aria-label={`Delete campaign: ${name}`}
        >
          <IconTrash className="h-4 w-4" aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-lg">
        <div className="border-b bg-muted/40 px-6 py-5 sm:px-6">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-left text-base font-semibold leading-snug sm:text-lg">
              {campaignDualDialogCopy.title}
            </AlertDialogTitle>
            <p className="break-words text-sm font-medium leading-snug text-foreground">
              <span className="text-muted-foreground font-normal">Campaign </span>
              <span title={name}>&ldquo;{name}&rdquo;</span>
            </p>
            <AlertDialogDescription asChild>
              <p className="text-left text-sm leading-relaxed text-muted-foreground">
                Pick one option below. You can always return here later unless you permanently delete.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5">
          {isAlreadySoftDeleted && (
            <div
              className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground dark:border-amber-500/35 dark:bg-amber-500/15"
              role="status"
            >
              <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
              <p className="min-w-0 leading-relaxed">
                <span className="font-medium text-foreground">Already removed from delivery.</span>{' '}
                You can only permanently delete it now, which also erases this campaign&apos;s
                activity history.
              </p>
            </div>
          )}

          <div className="grid gap-3">
            <section
              aria-labelledby="campaign-soft-delete-heading"
              className={cn(
                'rounded-lg border bg-card p-4 shadow-xs',
                isAlreadySoftDeleted && 'opacity-60'
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <IconBan className="size-5" stroke={1.75} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <h3 id="campaign-soft-delete-heading" className="text-sm font-semibold text-foreground">
                      Remove from delivery
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Stops delivering this campaign to users. The campaign and its activity
                      history stay here for reporting.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting !== null || isAlreadySoftDeleted}
                    className="h-10 w-full min-h-10 sm:w-auto"
                    onClick={() => void runDelete(false)}
                  >
                    {deleting === 'soft' ? (
                      <>
                        <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        Removing…
                      </>
                    ) : (
                      <>
                        <IconBan className="size-4" aria-hidden />
                        Remove from delivery
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="campaign-permanent-delete-heading"
              className="rounded-lg border border-destructive/35 bg-destructive/5 p-4 shadow-xs dark:border-destructive/40 dark:bg-destructive/10"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-destructive dark:bg-destructive/25"
                  aria-hidden
                >
                  <IconTrash className="size-5" stroke={1.75} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <h3 id="campaign-permanent-delete-heading" className="text-sm font-semibold text-foreground">
                      Permanently delete
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Deletes the campaign and{' '}
                      <span className="font-medium text-foreground">all activity</span> linked to
                      it. This cannot be undone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting !== null}
                    className="h-10 w-full min-h-10 sm:w-auto"
                    onClick={() => void runDelete(true)}
                  >
                    {deleting === 'permanent' ? (
                      <>
                        <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <IconTrash className="size-4" aria-hidden />
                        Permanently delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <AlertDialogFooter className="gap-3 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <AlertDialogCancel className="mt-0 h-10 min-h-10 w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteButton(props: DeleteButtonProps) {
  const { name, entityType, apiPath, redirectTo } = props;

  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const labels = useMemo(() => entityLabels[entityType], [entityType]);
  const disabled = entityType !== 'campaign' && props.disabled === true;
  const disabledReason = entityType !== 'campaign' ? props.disabledReason : undefined;
  const linkedHelp = entityType !== 'campaign' ? props.linkedHelp : undefined;

  useEffect(() => setMounted(true), []);

  if (entityType === 'campaign') {
    return (
      <CampaignAdminDeleteButton
        name={name}
        apiPath={apiPath}
        redirectTo={redirectTo}
        campaignStatus={props.campaignStatus}
      />
    );
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(apiPath, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || labels.errorMessage);
      }

      toast.success(labels.successMessage);
      if (redirectTo) {
        router.replace(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={contentDeleteTriggerClass}
        disabled
        tabIndex={-1}
      >
        <IconTrash className="h-4 w-4" />
        <span className="sr-only">Delete {entityType}</span>
      </Button>
    );
  }

  if (linkedHelp && disabledReason) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(contentDeleteTriggerClass)}
            aria-label={`Delete ${entityType}: blocked because it is used by campaigns. Opens details.`}
          >
            <IconTrash className="h-4 w-4" aria-hidden />
            <span className="sr-only">Delete {entityType} — see campaigns using this item</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[min(92vh,40rem)] w-full flex-col gap-0 overflow-hidden border-border/80 p-0 sm:max-w-xl">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
            <div className="flex flex-col gap-6">
              <DialogHeader className="space-y-3 pr-10 text-left sm:pr-12">
                <DialogTitle className="text-balance text-lg font-semibold leading-snug tracking-tight">
                  Cannot delete &quot;{name}&quot;
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{disabledReason}</p>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <h3
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  id={`blocked-delete-campaigns-${linkedHelp.entityId}`}
                >
                  Linked campaigns
                </h3>
                <div
                  className="max-h-60 min-h-0 scroll-py-2 overflow-y-auto overflow-x-hidden rounded-lg border border-border/70 bg-muted/10"
                  role="region"
                  aria-labelledby={`blocked-delete-campaigns-${linkedHelp.entityId}`}
                >
                  <LinkedCampaigns
                    type={linkedHelp.type}
                    entityId={linkedHelp.entityId}
                    embedded
                    variant="popover"
                    editLinks
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-col-reverse gap-3 border-t border-border/80 bg-muted/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:space-x-0 sm:px-8">
            <Button
              variant="outline"
              size="default"
              className="h-10 min-h-10 w-full border-border bg-background font-medium shadow-xs hover:bg-muted/50 sm:w-auto"
              asChild
            >
              <Link href="/campaigns">All campaigns</Link>
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="default" className="h-10 min-h-10 w-full sm:w-auto">
                Done
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (disabled) {
    const trashButton = (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(contentDeleteTriggerClass, 'opacity-50')}
        disabled
        aria-label={
          disabledReason
            ? `Delete unavailable: ${disabledReason}`
            : `Cannot delete ${entityType}`
        }
      >
        <IconTrash className="h-4 w-4" aria-hidden />
        <span className="sr-only">Delete {entityType} (unavailable)</span>
      </Button>
    );
    return disabledReason ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{trashButton}</span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-balance">
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    ) : (
      trashButton
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className={contentDeleteTriggerClass}>
          <IconTrash className="h-4 w-4" />
          <span className="sr-only">Delete {entityType}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
