/**
 * Get start date for a range key (days ago from now, start of day UTC).
 */
export function getStartDate(
  rangeKey: string,
  rangeDays: Record<string, number>,
  defaultDays: number
): Date {
  const days = rangeDays[rangeKey] ?? defaultDays;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Fill missing days in a date range. Calls getValue for each date to get the data point (object to merge with date).
 */
export function fillMissingDays<T extends object>(
  start: Date,
  end: Date,
  getValue: (dateStr: string) => T
): ({ date: string } & T)[] {
  const result: ({ date: string } & T)[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const endTime = end.getTime();

  while (current.getTime() <= endTime) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, ...getValue(dateStr) } as { date: string } & T);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

/**
 * Get date range with previous period for comparison.
 */
export function getDateRange(
  rangeKey: string,
  rangeDays: Record<string, number>,
  defaultDays: number
): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const days = rangeDays[rangeKey] ?? defaultDays;
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);

  const prevEnd = new Date(start);
  prevEnd.setUTCMilliseconds(-1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - days + 1);
  prevStart.setUTCHours(0, 0, 0, 0);

  return { start, end, prevStart, prevEnd };
}
