import * as React from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Use when the title should scale down on small viewports (e.g. filter-heavy pages). */
  titleClassName?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'app-rise-in flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1
          className={cn(
            'text-2xl font-semibold tracking-tight text-foreground',
            titleClassName
          )}
        >
          {title}
        </h1>
        {description != null ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions != null ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}
