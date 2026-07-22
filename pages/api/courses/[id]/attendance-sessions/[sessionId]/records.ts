import type { NextApiResponse } from "next";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

class AttendanceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role === "STUDENT") {
    return res.status(403).json({ error: "Only instructors and admins can clock attendance." });
  }

  const courseId = String(req.query.id ?? "");
  const sessionId = String(req.query.sessionId ?? "");
  const { studentId, action } = req.body as {
    studentId?: string;
    action?: "clockIn" | "clockOut";
  };

  if (!courseId || !sessionId || !studentId || !action) {
    return res.status(400).json({ error: "courseId, sessionId, studentId, and action are required." });
  }

  const attendanceSession = await prisma.attendanceSession.findFirst({
    where: {
      id: sessionId,
      courseId,
      ...(req.session.role === "ADMIN" ? {} : getManagedCourseWhere(req.session)),
    },
  });

  if (!attendanceSession) {
    return res.status(404).json({ error: "Attendance session not found." });
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId,
      studentId,
    },
    select: { id: true },
  });

  if (!enrollment) {
    return res.status(404).json({ error: "Student is not enrolled in this course." });
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const nextTimestamp = new Date();

      const updatedRecord = await tx.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId,
          },
        },
        update:
          action === "clockIn"
            ? { clockInAt: nextTimestamp, recordedById: req.session.userId }
            : { clockOutAt: nextTimestamp, recordedById: req.session.userId },
        create: {
          sessionId,
          studentId,
          recordedById: req.session.userId,
          clockInAt: action === "clockIn" ? nextTimestamp : null,
          clockOutAt: action === "clockOut" ? nextTimestamp : null,
        },
      });

      const column = await tx.gradebookColumn.findFirst({
        where: {
          courseId,
          type: "ATTENDANCE",
          sourceId: sessionId,
        },
        select: { id: true },
      });

      if (column) {
        await tx.gradebookCell.upsert({
          where: {
            columnId_studentId: {
              columnId: column.id,
              studentId,
            },
          },
          update: {
            score: updatedRecord.clockInAt ? 1 : 0,
          },
          create: {
            courseId,
            columnId: column.id,
            studentId,
            score: updatedRecord.clockInAt ? 1 : 0,
          },
        });
      }

      return updatedRecord;
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: action === "clockIn" ? "ATTENDANCE_CLOCK_IN" : "ATTENDANCE_CLOCK_OUT",
      targetType: "AttendanceRecord",
      targetId: record.id,
      details: `${action} for student ${studentId} in session ${attendanceSession.title}`,
    });

    return res.status(200).json({ record });
  } catch (error) {
    if (error instanceof AttendanceError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unable to update attendance." });
  }
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
