import { getLmsDateParts, parseLmsDateValue } from "@/lib/lmsTime";

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
  const weekday = getLmsDateParts(date).weekday;

  return WEEKDAY_OPTIONS[weekday]?.value ?? null;
}

export function getUpcomingAttendanceSessionDates(
  attendanceDays: WeekdayValue[],
  weeksAhead = 12,
  startingFrom = new Date(),
) {
  const selectedDays = new Set(attendanceDays);
  const dates: Date[] = [];
  const seen = new Set<string>();
  const startDate = new Date(startingFrom);
  startDate.setHours(0, 0, 0, 0);

  for (let weekOffset = 0; weekOffset < weeksAhead; weekOffset += 1) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const candidate = new Date(startDate);
      candidate.setDate(startDate.getDate() + weekOffset * 7 + dayOffset);

      const weekday = weekdayFromDate(candidate);
      if (!weekday || !selectedDays.has(weekday)) {
        continue;
      }

      const parts = getLmsDateParts(candidate);
      const key = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      const sessionDate = parseLmsDateValue(key);
      if (sessionDate) {
        dates.push(sessionDate);
      }
    }
  }

  return dates;
}


