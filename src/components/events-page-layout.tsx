'use client';

import * as React from 'react';
import { EventsSummaryPanel } from '@/components/events-summary-panel';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { CloseFilterPanelContext } from '@/components/filter-panel-context';
import { cn } from '@/lib/utils';
import { IconChartBar, IconFilter } from '@tabler/icons-react';

type EventsPageLayoutProps = {
  filterContent: React.ReactNode;
  children: React.ReactNode;
};

export function EventsPageLayout({
  filterContent,
  children,
}: EventsPageLayoutProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState(false);
  const closeFilterPanel = React.useCallback(() => setShowFilters(false), []);

  return (
    <CloseFilterPanelContext.Provider value={closeFilterPanel}>
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* No gap between header and panels: flex gap would add space even when both panels are collapsed (0fr). */}
      <div className="flex flex-col">
        <PageHeader
          title="Events"
          description="Activity from your extension across all campaigns — newest first."
          actions={
            <>
              <Button
                type="button"
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => {
                  setShowFilters((open) => {
                    const next = !open;
                    if (next) setShowStatus(false);
                    return next;
                  });
                }}
                className="min-h-9 gap-2"
                aria-expanded={showFilters}
                aria-controls="events-filters-panel"
              >
                <IconFilter className="h-4 w-4" aria-hidden />
                {showFilters ? 'Hide filters' : 'Filter'}
              </Button>
              <Button
                type="button"
                variant={showStatus ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => {
                  setShowStatus((open) => {
                    const next = !open;
                    if (next) setShowFilters(false);
                    return next;
                  });
                }}
                className="min-h-9 gap-2"
                aria-expanded={showStatus}
                aria-controls="events-status-panel"
              >
                <IconChartBar className="h-4 w-4" aria-hidden />
                {showStatus ? 'Hide summary' : 'Summary'}
              </Button>
            </>
          }
        />

        <div
          id="events-filters-panel"
          className={cn(
            'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none',
            showFilters && 'mt-3'
          )}
          style={{ gridTemplateRows: showFilters ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className="motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
              style={{ opacity: showFilters ? 1 : 0 }}
              aria-hidden={!showFilters}
              inert={!showFilters ? true : undefined}
            >
              {filterContent}
            </div>
          </div>
        </div>

        <div
          id="events-status-panel"
          className={cn(
            'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none',
            showStatus && 'mt-3'
          )}
          style={{ gridTemplateRows: showStatus ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className="motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
              style={{ opacity: showStatus ? 1 : 0 }}
              aria-hidden={!showStatus}
              inert={!showStatus ? true : undefined}
            >
              <EventsSummaryPanel expanded={showStatus} />
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
    </CloseFilterPanelContext.Provider>
  );
}
