import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeImageInput } from "@/lib/media";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { normalizeManagerIds } from "@/lib/courseManagers";
import { canManageCourse } from "@/lib/permissions";
import { normalizeAttendanceDays } from "@/lib/attendance";
import { ensureCourseAttendanceSessions } from "@/lib/attendanceSessions";
import { parseCourseDate, parseCourseDurationWeeks, validateCourseSchedule } from "@/lib/courseSchedule";
import { syncCourseAttendanceGradebook } from "@/lib/gradebook";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const courseId = String(req.query.id);
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  const courseManagerIds = await prisma.courseManager.findMany({
    where: { courseId },
    select: { userId: true },
  });

  if (!canManageCourse(req.session, [course.instructorId, course.createdById, ...courseManagerIds.map((manager) => manager.userId)].filter(Boolean) as string[])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "DELETE") {
    if (course.status !== "ARCHIVED") {
      return res.status(400).json({ error: "Archive this course first before deleting permanently." });
    }

    const dependencies = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        _count: {
          select: {
            enrollments: true,
            lessons: true,
            resources: true,
            assignments: true,
            quizzes: true,
            announcements: true,
            questions: true,
          },
        },
      },
    });

    const blockingItems = [
      { label: "enrollments", count: dependencies?._count.enrollments ?? 0 },
      { label: "modules", count: dependencies?._count.lessons ?? 0 },
      { label: "resources", count: dependencies?._count.resources ?? 0 },
      { label: "assignments", count: dependencies?._count.assignments ?? 0 },
      { label: "quizzes", count: dependencies?._count.quizzes ?? 0 },
      { label: "announcements", count: dependencies?._count.announcements ?? 0 },
      { label: "Q&A threads", count: dependencies?._count.questions ?? 0 },
    ].filter((item) => item.count > 0);

    if (blockingItems.length > 0) {
      return res.status(409).json({
        error: `This course cannot be deleted until related records are removed: ${blockingItems
          .map((item) => `${item.count} ${item.label}`)
          .join(", ")}.`,
      });
    }

    await prisma.course.delete({ where: { id: courseId } });

    await createAuditLog({
      actorId: req.session.userId,
      action: "COURSE_DELETED",
      targetType: "Course",
      targetId: courseId,
      details: `Deleted course ${course.title}`,
    });

    return res.status(200).json({ success: true });
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    title,
    description,
    thumbnailUrl,
    status,
    instructorId,
    managerIds,
    attendanceDays,
    startDate,
    endDate,
    durationWeeks,
  } = req.body as {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    instructorId?: string;
    managerIds?: string | string[];
    attendanceDays?: string | string[];
    startDate?: string;
    endDate?: string;
    durationWeeks?: string | number;
  };

  let normalizedThumbnailUrl: string | null | undefined;

  try {
    normalizedThumbnailUrl = normalizeImageInput(thumbnailUrl, "Course thumbnail");
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid course thumbnail.",
    });
  }

  if ((status === "ARCHIVED" || course.status === "ARCHIVED") && typeof status !== "undefined" && req.session.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can archive or restore courses." });
  }

  const normalizedManagerIds = normalizeManagerIds(managerIds);

  const hasScheduleInput = ["attendanceDays", "startDate", "endDate", "durationWeeks"].some((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field),
  );
  const nextAttendanceDays = Object.prototype.hasOwnProperty.call(req.body, "attendanceDays")
    ? normalizeAttendanceDays(attendanceDays)
    : normalizeAttendanceDays(course.attendanceDays);
  const nextStartDate = Object.prototype.hasOwnProperty.call(req.body, "startDate")
    ? parseCourseDate(startDate)
    : course.startDate;
  const nextEndDate = Object.prototype.hasOwnProperty.call(req.body, "endDate")
    ? parseCourseDate(endDate)
    : course.endDate;
  const nextDurationWeeks = Object.prototype.hasOwnProperty.call(req.body, "durationWeeks")
    ? parseCourseDurationWeeks(durationWeeks)
    : course.durationWeeks;

  if (hasScheduleInput) {
    const scheduleError = validateCourseSchedule({
      attendanceDays: nextAttendanceDays,
      startDate: nextStartDate,
      endDate: nextEndDate,
      durationWeeks: nextDurationWeeks,
    });

    if (scheduleError) {
      return res.status(400).json({ error: scheduleError });
    }
  }

  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      title,
      description,
      thumbnailUrl: normalizedThumbnailUrl,
      status:
        typeof status === "undefined"
          ? undefined
          : status === "ARCHIVED" && req.session.role !== "ADMIN"
            ? course.status
            : status,
      instructorId: req.session.role === "ADMIN" ? instructorId ?? course.instructorId : course.instructorId,
      courseManagers:
        req.session.role === "ADMIN"
          ? {
              deleteMany: {},
              create: normalizedManagerIds.map((userId) => ({
                userId,
              })),
            }
          : undefined,
      attendanceDays: hasScheduleInput ? nextAttendanceDays : undefined,
      startDate: hasScheduleInput ? nextStartDate : undefined,
      endDate: hasScheduleInput ? nextEndDate : undefined,
      durationWeeks: hasScheduleInput ? nextDurationWeeks : undefined,
    },
  });

  if (hasScheduleInput) {
    await ensureCourseAttendanceSessions({
      courseId: updatedCourse.id,
      courseTitle: updatedCourse.title,
      attendanceDays: normalizeAttendanceDays(updatedCourse.attendanceDays),
      startDate: updatedCourse.startDate,
      durationWeeks: updatedCourse.durationWeeks,
      createdById: req.session.userId,
    });
    await syncCourseAttendanceGradebook(updatedCourse.id);
  }

  await createAuditLog({
    actorId: req.session.userId,
    action: "COURSE_UPDATED",
    targetType: "Course",
    targetId: courseId,
    details: `Updated course ${updatedCourse.title}`,
  });

  return res.status(200).json({ course: updatedCourse });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};


