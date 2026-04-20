'use client';

import * as React from 'react';
import { UsersTable } from '@/components/users-table';
import { UsersBulkToolbar } from '@/components/users-bulk-toolbar';
import type { EndUserListRow } from '@/lib/end-users-dashboard';

export function UsersPageTableSection({
  rows,
  isAdmin,
}: {
  rows: EndUserListRow[];
  isAdmin: boolean;
}) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(rows.map((r) => r.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const selection = isAdmin
    ? {
        selectedIds,
        onToggleRow: (id: string, checked: boolean) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          });
        },
        onTogglePage: (checked: boolean) => {
          const pageIds = rows.map((r) => r.id);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) for (const id of pageIds) next.add(id);
            else for (const id of pageIds) next.delete(id);
            return next;
          });
        },
      }
    : undefined;

  const selectedArr = React.useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <div className="space-y-3">
      {isAdmin ? (
        <UsersBulkToolbar selectedIds={selectedArr} onClear={() => setSelectedIds(new Set())} />
      ) : null}
      <UsersTable rows={rows} isAdmin={isAdmin} selection={selection} />
    </div>
  );
}
