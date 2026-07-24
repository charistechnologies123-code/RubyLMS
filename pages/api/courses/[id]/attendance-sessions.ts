import type { NextApiResponse } from "next";
import { createGradebookColumn } from "@/lib/gradebook";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { weekdayFromDate } from "@/lib/attendance";
import { parseLmsDateTimeLocalValue, parseLmsDateValue } from "@/lib/lmsTime";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const courseId = String(req.query.id ?? "");

  if (!courseId) {
    return res.status(400).json({ error: "courseId is required." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(req.session.role === "ADMIN"
        ? {}
        : req.session.role === "INSTRUCTOR"
          ? getManagedCourseWhere(req.session)
          : {
              status: "PUBLISHED",
              enrollments: {
                some: {
                  studentId: req.session.userId,
                },
              },
            }),
    },
    include: {
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              studentId: true,
              email: true,
            },
          },
        },
      },
      attendanceSessions: {
        orderBy: { sessionDate: "desc" },
        include: {
          createdBy: {
            select: { id: true, fullName: true, role: true },
          },
          records: {
            include: {
              student: {
                select: { id: true, fullName: true, studentId: true, email: true },
              },
              recordedBy: {
                select: { id: true, fullName: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  if (req.method === "GET") {
    return res.status(200).json({ course });
  }

  if (req.method === "POST") {
    if (req.session.role === "STUDENT") {
      return res.status(403).json({ error: "Only instructors and admins can create attendance sessions." });
    }

    const { title, sessionDate, startsAt, endsAt } = req.body as {
      title?: string;
      sessionDate?: string;
      startsAt?: string;
      endsAt?: string;
    };

    if (!title?.trim() || !sessionDate) {
      return res.status(400).json({ error: "title and sessionDate are required." });
    }

    const sessionDateTime = parseLmsDateValue(sessionDate);

    if (!sessionDateTime || Number.isNaN(sessionDateTime.getTime())) {
      return res.status(400).json({ error: "Invalid session date." });
    }

    const weekday = weekdayFromDate(sessionDateTime);

    if (course.attendanceDays.length && weekday && !course.attendanceDays.includes(weekday)) {
      return res.status(400).json({ error: "This date does not match the course attendance days." });
    }

    const attendanceSession = await prisma.attendanceSession.create({
      data: {
        courseId,
        createdById: req.session.userId,
        title: title.trim(),
        sessionDate: sessionDateTime,
        startsAt: startsAt ? parseLmsDateTimeLocalValue(startsAt) : null,
        endsAt: endsAt ? parseLmsDateTimeLocalValue(endsAt) : null,
      },
    });

    const column = await createGradebookColumn({
      courseId,
      title: attendanceSession.title,
      type: "ATTENDANCE",
      sourceId: attendanceSession.id,
      maxScore: 1,
      createdById: req.session.userId,
    });

    await prisma.gradebookCell.updateMany({
      where: { columnId: column.id },
      data: { score: 0 },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "ATTENDANCE_SESSION_CREATED",
      targetType: "AttendanceSession",
      targetId: attendanceSession.id,
      details: `Created attendance session ${attendanceSession.title}`,
    });

    return res.status(201).json({ attendanceSession });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);

