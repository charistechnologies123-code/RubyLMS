import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canEnrollStudents, canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!canEnrollStudents(req.session)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { courseId, studentId, studentIds, enrollmentId } = req.body as {
    courseId?: string;
    studentId?: string;
    studentIds?: string | string[];
    enrollmentId?: string;
  };

  if (req.method === "DELETE") {
    if (!enrollmentId) {
      return res.status(400).json({ error: "enrollmentId is required." });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found." });
    }

    if (!canManageCourse(req.session, enrollment.course.instructorId) && req.session.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.enrollment.delete({ where: { id: enrollmentId } });

    await createAuditLog({
      actorId: req.session.userId,
      action: "ENROLLMENT_DELETED",
      targetType: "Enrollment",
      targetId: enrollmentId,
      details: `Unenrolled ${enrollment.studentId} from ${enrollment.course.title}`,
    });

    return res.status(200).json({ success: true });
  }

  const selectedStudentIds = Array.isArray(studentIds)
    ? studentIds
    : typeof studentIds === "string"
      ? [studentIds]
      : typeof studentId === "string"
        ? [studentId]
        : [];

  const uniqueStudentIds = [...new Set(selectedStudentIds.map((value) => value.trim()).filter(Boolean))];

  if (!courseId || !uniqueStudentIds.length) {
    return res.status(400).json({ error: "courseId and at least one student are required." });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  const courseManagers = await prisma.courseManager.findMany({
    where: { courseId },
    select: { userId: true },
  });

  if (
    !canManageCourse(
      req.session,
      [course.instructorId, course.createdById, ...courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
    ) &&
    req.session.role !== "ADMIN"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const existingEnrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      studentId: { in: uniqueStudentIds },
    },
    select: { studentId: true },
  });

  const existingStudentIds = new Set(existingEnrollments.map((enrollment) => enrollment.studentId));
  const studentIdsToCreate = uniqueStudentIds.filter((value) => !existingStudentIds.has(value));

  if (!studentIdsToCreate.length) {
    return res.status(200).json({ enrollments: [], skipped: uniqueStudentIds.length });
  }

  const enrollments = await prisma.$transaction(
    studentIdsToCreate.map((studentId) =>
      prisma.enrollment.create({
        data: {
          courseId,
          studentId,
        },
      }),
    ),
  );

  await Promise.all(
    studentIdsToCreate.map((studentId) => notifyUsers([studentId], "Enrollment confirmed", `You have been added to ${course.title}.`)),
  );

  await createAuditLog({
    actorId: req.session.userId,
    action: "ENROLLMENT_CREATED",
    targetType: "Enrollment",
    targetId: enrollments[0]?.id ?? course.id,
    details: `Enrolled ${studentIdsToCreate.length} student(s) in ${course.title}`,
  });

  return res.status(201).json({ enrollments, skipped: uniqueStudentIds.length - studentIdsToCreate.length });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
