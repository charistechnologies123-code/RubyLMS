export const WEEKDAY_OPTIONS = [
  { label: 'Monday', value: 'MONDAY' },
  { label: 'Tuesday', value: 'TUESDAY' },
  { label: 'Wednesday', value: 'WEDNESDAY' },
  { label: 'Thursday', value: 'THURSDAY' },
  { label: 'Friday', value: 'FRIDAY' },
  { label: 'Saturday', value: 'SATURDAY' },
  { label: 'Sunday', value: 'SUNDAY' },
] as const;

export type WeekdayValue = (typeof WEEKDAY_OPTIONS)[number]['value'];

export function normalizeAttendanceDays(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const normalized = values.filter((day): day is WeekdayValue =>
    WEEKDAY_OPTIONS.some((option) => option.value === day),
  );

  return Array.from(new Set(normalized));
}

export function weekdayLabel(value: string) {
  return WEEKDAY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function weekdayFromDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const weekday = date.getDay();

  return WEEKDAY_OPTIONS[weekday]?.value ?? null;
}
