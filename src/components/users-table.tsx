import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EndUserRowActions } from '@/components/end-user-row-actions';
import { UserIdentityCell } from '@/components/user-identity-cell';
import type { EndUserListRow } from '@/lib/end-users-dashboard';
import { computeExtensionDaysLeft, formatExtensionDaysLeftCell } from '@/lib/extension-user-subscription';

interface UsersTableProps {
  rows: EndUserListRow[];
}

export function UsersTable({ rows }: UsersTableProps) {
  const colCount = 10;

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">User</TableHead>
            <TableHead className="min-w-[72px]">Plan</TableHead>
            <TableHead className="min-w-[88px]">Status</TableHead>
            <TableHead className="w-[88px]">Country</TableHead>
            <TableHead className="text-right w-[96px] tabular-nums">Impressions</TableHead>
            <TableHead className="min-w-[140px]">Start date</TableHead>
            <TableHead className="min-w-[140px]">End date</TableHead>
            <TableHead className="min-w-[140px]">Last session</TableHead>
            <TableHead className="text-center w-[96px]">Days left</TableHead>
            <TableHead className="min-w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">
                No users match your filters. Try adjusting your filters or removing them.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((v) => {
              const daysLeft = formatExtensionDaysLeftCell(
                computeExtensionDaysLeft({ endDate: v.endDate })
              );
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <UserIdentityCell
                      endUserId={v.id}
                      shortId={v.shortId}
                      displayEmail={v.email}
                      displayName={v.name}
                    />
                  </TableCell>
                  <TableCell className="capitalize text-sm">{v.plan}</TableCell>
                  <TableCell className="capitalize text-sm">{v.status}</TableCell>
                  <TableCell>
                    {v.country ? (
                      <span className="uppercase">{v.country}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{v.impressionCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(v.startDate).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {v.endDate ? new Date(v.endDate).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {v.lastSessionAt ? new Date(v.lastSessionAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">{daysLeft}</TableCell>
                  <TableCell className="text-right">
                    <EndUserRowActions userId={v.id} email={v.email} shortId={v.shortId} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
