import Link from 'next/link';
import { IconTargetOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function CampaignNotFound() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <main
        className="flex min-h-[min(56vh,480px)] flex-1 flex-col items-center justify-center py-8"
        aria-labelledby="campaign-not-found-title"
      >
        <Card
          className={cn(
            'w-full max-w-lg gap-0 py-0',
            'border-dashed border-border/80 bg-muted/10 shadow-none'
          )}
        >
          <div className="flex flex-col items-center px-6 pt-10 pb-8 text-center sm:px-8">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60"
              aria-hidden
            >
              <IconTargetOff className="size-8" stroke={1.5} />
            </div>

            <div className="mt-8 max-w-prose space-y-3">
              <h1
                id="campaign-not-found-title"
                className="text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                This campaign doesn&apos;t exist
              </h1>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                It may have been deleted, or the ID in the link is wrong. If you opened this from the
                event log, the campaign may no longer be available to your account.
              </p>
            </div>

            <div
              className="mt-10 flex w-full max-w-sm flex-col gap-3 border-t border-border/50 pt-8"
              role="group"
              aria-label="Next steps"
            >
              <Button asChild size="lg" className="min-h-11 w-full">
                <Link href="/campaigns">Back to campaigns</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="min-h-11 w-full text-muted-foreground hover:text-foreground"
              >
                <Link href="/events">View event log</Link>
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
