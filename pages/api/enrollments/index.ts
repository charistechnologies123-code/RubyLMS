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

  const { courseId, studentId, enrollmentId } = req.body as {
    courseId?: string;
    studentId?: string;
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

  if (!courseId || !studentId) {
    return res.status(400).json({ error: "courseId and studentId are required." });
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

  const enrollment = await prisma.enrollment.create({
    data: {
      courseId,
      studentId,
    },
  });

  await notifyUsers([studentId], "Enrollment confirmed", `You have been added to ${course.title}.`);

  await createAuditLog({
    actorId: req.session.userId,
    action: "ENROLLMENT_CREATED",
    targetType: "Enrollment",
    targetId: enrollment.id,
    details: `Enrolled ${studentId} in ${course.title}`,
  });

  return res.status(201).json({ enrollment });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
