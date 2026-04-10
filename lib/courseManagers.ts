import type { SessionUser } from "@/lib/auth";

export function getManagedCourseWhere(session: SessionUser) {
  return {
    OR: [
      { instructorId: session.userId },
      { createdById: session.userId },
      { courseManagers: { some: { userId: session.userId } } },
    ],
  };
}

export function normalizeManagerIds(value: unknown) {
  const rawValues = Array.isArray(value) ? value : typeof value === "undefined" ? [] : [value];

  return [...new Set(rawValues.map((entry) => String(entry).trim()).filter(Boolean))];
}
