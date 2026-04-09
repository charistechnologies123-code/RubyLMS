import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canEnrollStudents, canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!canEnrollStudents(req.session)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { courseId, studentId } = req.body as {
    courseId?: string;
    studentId?: string;
  };

  if (!courseId || !studentId) {
    return res.status(400).json({ error: "courseId and studentId are required." });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  if (!canManageCourse(req.session, course.instructorId) && req.session.role !== "ADMIN") {
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
