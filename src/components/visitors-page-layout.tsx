'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconFilter } from '@tabler/icons-react';

interface VisitorsPageLayoutProps {
  filterContent: React.ReactNode;
  children: React.ReactNode;
}

export function VisitorsPageLayout({
  filterContent,
  children,
}: VisitorsPageLayoutProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Unique Visitors</h1>
          <p className="text-muted-foreground">
            Extension users who have interacted with your campaigns
          </p>
        </div>
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="shrink-0"
        >
          <IconFilter className="h-4 w-4 mr-2" />
          {showFilters ? 'Hide filters' : 'Filters'}
        </Button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: showFilters ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="transition-opacity duration-300 ease-out" style={{ opacity: showFilters ? 1 : 0 }}>
            {filterContent}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
