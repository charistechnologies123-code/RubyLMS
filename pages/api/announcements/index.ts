import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { canManageCourse } from "@/lib/permissions";
import { normalizeImageInput } from "@/lib/media";

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
              course: getManagedCourseWhere(req.session),
            }
          : {};

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        course: true,
        createdBy: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({ announcements });
  }

  if (req.method === "POST") {
    const { courseId, title, content, imageUrl } = req.body as {
      courseId?: string;
      title?: string;
      content?: string;
      imageUrl?: string;
    };

    if (!courseId || !title || !content) {
      return res.status(400).json({ error: "courseId, title, and content are required." });
    }

    let normalizedImageUrl: string | null | undefined;

    try {
      normalizedImageUrl = normalizeImageInput(imageUrl, "Announcement image");
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid announcement image.",
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

    const announcement = await prisma.announcement.create({
      data: {
        courseId,
        title,
        content,
        imageUrl: normalizedImageUrl,
        createdById: req.session.userId,
      },
    });

    await notifyUsers(
      course.enrollments.map((enrollment) => enrollment.studentId),
      "New announcement",
      `${title} was posted in ${course.title}.`,
    );

    await createAuditLog({
      actorId: req.session.userId,
      action: "ANNOUNCEMENT_CREATED",
      targetType: "Announcement",
      targetId: announcement.id,
      details: title,
    });

    return res.status(201).json({ announcement });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
