import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getVisibleAssignmentWhere } from "@/lib/lms";
import { normalizeFileInput } from "@/lib/media";
import { canManageCourse } from "@/lib/permissions";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const assignments = await prisma.assignment.findMany({
      where: getVisibleAssignmentWhere(req.session),
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
    const { courseId, lessonId, title, description, instructions, attachmentUrl, dueAt, submissionType, status } =
      req.body as {
        courseId?: string;
        lessonId?: string;
        title?: string;
        description?: string;
        instructions?: string;
        attachmentUrl?: string;
        dueAt?: string;
        submissionType?: "FILE" | "LINK" | "TEXT";
        status?: "DRAFT" | "PUBLISHED";
      };

    if (!courseId || !title || !description) {
      return res.status(400).json({ error: "courseId, title, and description are required." });
    }

    let normalizedAttachmentUrl: string | null | undefined;

    try {
      normalizedAttachmentUrl = normalizeFileInput(attachmentUrl, "Assignment attachment");
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid assignment attachment.",
      });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { enrollments: true, courseManagers: true },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }

    if (
      !canManageCourse(
        req.session,
        [course.instructorId, course.createdById, ...course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
      )
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        lessonId: lessonId || null,
        title,
        description,
        instructions: instructions || null,
        attachmentUrl: normalizedAttachmentUrl,
        status: status ?? "DRAFT",
        dueAt: dueAt ? new Date(dueAt) : null,
        submissionType: submissionType ?? "FILE",
        createdById: req.session.userId,
      },
    });

    if (assignment.status === "PUBLISHED") {
      await notifyUsers(
        course.enrollments.map((enrollment) => enrollment.studentId),
        "New assignment published",
        `${assignment.title} was added to ${course.title}.`,
      );
    }

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
