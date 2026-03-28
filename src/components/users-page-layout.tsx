'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconFilter } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface UsersPageLayoutProps {
  filterContent: React.ReactNode;
  children: React.ReactNode;
}

export function UsersPageLayout({ filterContent, children }: UsersPageLayoutProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Users</h1>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
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
        <p className="text-sm text-muted-foreground">Trial and paid extension users; telemetry on Events.</p>
      </header>

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
  );
}
