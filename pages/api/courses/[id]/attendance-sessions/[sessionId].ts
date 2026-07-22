import type { NextApiResponse } from "next";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const courseId = String(req.query.id ?? "");
  const sessionId = String(req.query.sessionId ?? "");

  if (!courseId || !sessionId) {
    return res.status(400).json({ error: "courseId and sessionId are required." });
  }

  const attendanceSession = await prisma.attendanceSession.findFirst({
    where: {
      id: sessionId,
      courseId,
      ...(req.session.role === "ADMIN"
        ? {}
        : req.session.role === "INSTRUCTOR"
          ? getManagedCourseWhere(req.session)
          : {
              course: {
                status: "PUBLISHED",
                enrollments: {
                  some: {
                    studentId: req.session.userId,
                  },
                },
              },
            }),
    },
    include: {
      records: true,
    },
  });

  if (!attendanceSession) {
    return res.status(404).json({ error: "Attendance session not found." });
  }

  if (req.method === "DELETE") {
    if (req.session.role === "STUDENT") {
      return res.status(403).json({ error: "Only instructors and admins can delete attendance sessions." });
    }

    await prisma.attendanceSession.delete({ where: { id: attendanceSession.id } });

    await createAuditLog({
      actorId: req.session.userId,
      action: "ATTENDANCE_SESSION_DELETED",
      targetType: "AttendanceSession",
      targetId: attendanceSession.id,
      details: `Deleted attendance session ${attendanceSession.title}`,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
