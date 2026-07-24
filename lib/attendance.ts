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

function lmsDateKey(value: Date) {
  const parts = getLmsDateParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getCourseAttendanceSessionDates(
  attendanceDays: WeekdayValue[],
  startDate: Date,
  durationWeeks: number,
) {
  const selectedDays = new Set(attendanceDays);
  const dates: Date[] = [];
  const normalizedDuration = Math.max(0, Math.floor(durationWeeks));
  const normalizedStartDate = parseLmsDateValue(lmsDateKey(startDate));

  if (!selectedDays.size || !normalizedStartDate || !normalizedDuration) {
    return dates;
  }

  for (const attendanceDay of attendanceDays) {
    let firstOccurrence = normalizedStartDate;

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const candidate = addDays(normalizedStartDate, dayOffset);
      if (weekdayFromDate(candidate) === attendanceDay) {
        firstOccurrence = candidate;
        break;
      }
    }

    for (let weekOffset = 0; weekOffset < normalizedDuration; weekOffset += 1) {
      const candidate = addDays(firstOccurrence, weekOffset * 7);
      const sessionDate = parseLmsDateValue(lmsDateKey(candidate));

      if (sessionDate) {
        dates.push(sessionDate);
      }
    }
  }

  return dates.sort((left, right) => left.getTime() - right.getTime());
}


