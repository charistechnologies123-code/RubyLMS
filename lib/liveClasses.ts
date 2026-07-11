import type { SessionUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";

export type LiveClassStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

export type LiveClassCourseContext = {
  instructorId: string | null;
  createdById: string;
  courseManagers: Array<{ userId: string }>;
};

export function buildLiveClassRoomName(courseSlug: string) {
  return `rubylms-${courseSlug}-${crypto.randomUUID()}`;
}

export function canManageLiveClass(session: SessionUser, course: LiveClassCourseContext) {
  return canManageCourse(
    session,
    [course.instructorId, course.createdById, ...course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
  );
}

export function isLiveClassJoinable(liveClass: {
  status: LiveClassStatus;
  startsAt: Date | string;
  endsAt: Date | string | null;
}) {
  if (liveClass.status === "CANCELLED" || liveClass.status === "ENDED") {
    return false;
  }

  const startsAt = new Date(liveClass.startsAt).getTime();
  const endsAt = liveClass.endsAt ? new Date(liveClass.endsAt).getTime() : null;
  const now = Date.now();

  if (now < startsAt - 15 * 60 * 1000) {
    return false;
  }

  if (endsAt && now > endsAt + 30 * 60 * 1000) {
    return false;
  }

  return true;
}

export function getLiveClassStateLabel(liveClass: {
  status: LiveClassStatus;
  startsAt: Date | string;
  endsAt: Date | string | null;
}) {
  if (liveClass.status === "CANCELLED") {
    return "Cancelled";
  }

  if (liveClass.status === "ENDED") {
    return "Ended";
  }

  const startsAt = new Date(liveClass.startsAt).getTime();
  const endsAt = liveClass.endsAt ? new Date(liveClass.endsAt).getTime() : null;
  const now = Date.now();

  if (now < startsAt) {
    return "Scheduled";
  }

  if (endsAt && now > endsAt) {
    return "Ended";
  }

  return liveClass.status === "LIVE" ? "Live now" : "Ready to join";
}

