export const LMS_TIME_ZONE = "Africa/Lagos";
const LMS_TIME_OFFSET_MINUTES = 60;

function shiftToLmsTime(value: Date) {
  return new Date(value.getTime() + LMS_TIME_OFFSET_MINUTES * 60 * 1000);
}

function parseDateTimeParts(value: string) {
  const [datePart, timePart = "00:00"] = value.trim().split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return { year, month, day, hours, minutes };
}

export function toLmsDateTimeLocalValue(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return shiftToLmsTime(date).toISOString().slice(0, 16);
}

export function parseLmsDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const parts = parseDateTimeParts(value);
  if (!parts) {
    return null;
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes) - LMS_TIME_OFFSET_MINUTES * 60 * 1000);
}

export function parseLmsDateValue(value?: string | null, hour = 12, minute = 0) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.trim().split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute) - LMS_TIME_OFFSET_MINUTES * 60 * 1000);
}

export function getLmsDateParts(value: Date) {
  const shifted = shiftToLmsTime(value);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}
