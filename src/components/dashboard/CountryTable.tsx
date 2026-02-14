import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCountryName } from '@/lib/countries';

interface CountryTableProps {
  data: { country: string | null; count: number }[];
}

export function CountryTable({ data }: CountryTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No country data yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
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
    </div>
  );
}
