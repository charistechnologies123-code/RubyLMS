import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const where =
      req.session.role === "STUDENT"
        ? {
            course: {
              enrollments: {
                some: {
                  studentId: req.session.userId,
                },
              },
            },
          }
        : req.session.role === "INSTRUCTOR"
          ? {
              course: {
                OR: [{ instructorId: req.session.userId }, { createdById: req.session.userId }],
              },
            }
          : {};

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: {
        course: true,
        submissions: {
          include: {
            student: {
              select: {
                fullName: true,
                email: true,
                studentId: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ assignments });
  }

  if (req.method === "POST") {
    const { courseId, lessonId, title, description, instructions, attachmentUrl, dueAt, submissionType } =
      req.body as {
        courseId?: string;
        lessonId?: string;
        title?: string;
        description?: string;
        instructions?: string;
        attachmentUrl?: string;
        dueAt?: string;
        submissionType?: "FILE" | "LINK" | "TEXT";
      };

    if (!courseId || !title || !description) {
      return res.status(400).json({ error: "courseId, title, and description are required." });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { enrollments: true },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }

    if (!canManageCourse(req.session, course.instructorId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        lessonId: lessonId || null,
        title,
        description,
        instructions: instructions || null,
        attachmentUrl: attachmentUrl || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        submissionType: submissionType ?? "FILE",
        createdById: req.session.userId,
      },
    });

    await notifyUsers(
      course.enrollments.map((enrollment) => enrollment.studentId),
      "New assignment published",
      `${assignment.title} was added to ${course.title}.`,
    );

    await createAuditLog({
      actorId: req.session.userId,
      action: "ASSIGNMENT_CREATED",
      targetType: "Assignment",
      targetId: assignment.id,
      details: `Created assignment ${assignment.title}`,
    });

    return res.status(201).json({ assignment });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
