import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getCountryName } from '@/lib/countries';

interface CountryTableProps {
  data: { country: string | null; count: number }[];
  /** When true, no bordered wrapper — heading + table only (e.g. campaign overview). */
  embedded?: boolean;
}

export function CountryTable({ data, embedded = false }: CountryTableProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'text-sm leading-relaxed text-muted-foreground',
          embedded
            ? 'py-1'
            : 'flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-border px-4 py-8 text-center'
        )}
      >
        No country data in this range. Country breakdown will appear once impressions are recorded.
      </div>
    );
  }

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Country</TableHead>
          <TableHead className="text-xs text-right">Impressions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.country ?? 'unknown'}>
            <TableCell className="text-sm font-medium">
              {row.country ? getCountryName(row.country) : 'Unknown'} ({row.country ?? '??'})
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {row.count.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (embedded) {
    return table;
  }

  return <div className="overflow-hidden rounded-md border">{table}</div>;
}
