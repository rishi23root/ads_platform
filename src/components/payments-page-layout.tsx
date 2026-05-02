'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { IconFilter } from '@tabler/icons-react';

interface PaymentsPageLayoutProps {
  filterContent: React.ReactNode;
  children: React.ReactNode;
}

export function PaymentsPageLayout({ filterContent, children }: PaymentsPageLayoutProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Payments"
        description="Revenue and payment history from your users."
        actions={
          <Button
            type="button"
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0 motion-reduce:transition-none"
            aria-expanded={showFilters}
            aria-controls="payments-filters-panel"
          >
            <IconFilter className="h-4 w-4 mr-2" aria-hidden="true" />
            {showFilters ? 'Hide filters' : 'Filters'}
          </Button>
        }
      />

      <div
        id="payments-filters-panel"
        className="grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
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
      {children}
    </div>
  );
}
