'use client';

import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { IconFilter } from '@tabler/icons-react';
import { CloseFilterPanelContext } from '@/components/filter-panel-context';
import { cn } from '@/lib/utils';

interface UsersPageLayoutProps {
  filterContent: React.ReactNode;
  children: React.ReactNode;
  /** Optional prominent action shown before Filters in the page header. */
  primaryAction?: React.ReactNode;
}

export function UsersPageLayout({ filterContent, children, primaryAction }: UsersPageLayoutProps) {
  const [showFilters, setShowFilters] = useState(false);
  const closeFilterPanel = useCallback(() => setShowFilters(false), []);

  return (
    <CloseFilterPanelContext.Provider value={closeFilterPanel}>
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Users"
        description="People using your extension. Activity details live on Events."
        titleClassName="text-xl font-semibold tracking-tight md:text-2xl"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {primaryAction}
            <Button
              variant={showFilters ? 'secondary' : 'ghost'}
              size="sm"
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
              aria-expanded={showFilters}
              aria-controls="users-filters-panel"
            >
              <IconFilter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide filters' : 'Filters'}
            </Button>
          </div>
        }
      />

      {/* Nested: avoids double flex gap (header→panel→content) when panel height is 0 */}
      <div className={cn('flex flex-col min-h-0', showFilters ? 'gap-4' : 'gap-0')}>
        <div
          id="users-filters-panel"
          role="region"
          aria-label="User filters"
          className={cn(
            'grid min-h-0 overflow-hidden transition-[grid-template-rows] duration-300 ease-out',
            'motion-reduce:transition-none motion-reduce:duration-0'
          )}
          style={{ gridTemplateRows: showFilters ? '1fr' : '0fr' }}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                'transition-opacity duration-300 ease-out',
                'motion-reduce:transition-none motion-reduce:duration-0',
                showFilters ? 'opacity-100' : 'opacity-0 pointer-events-none select-none'
              )}
              aria-hidden={!showFilters}
            >
              {filterContent}
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
    </CloseFilterPanelContext.Provider>
  );
}
