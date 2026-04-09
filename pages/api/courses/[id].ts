import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeImageInput } from "@/lib/media";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const courseId = String(req.query.id);
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  if (!canManageCourse(req.session, course.instructorId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "DELETE") {
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

  const { title, description, thumbnailUrl, status, instructorId } = req.body as {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    instructorId?: string;
  };

  let normalizedThumbnailUrl: string | null | undefined;

  try {
    normalizedThumbnailUrl = normalizeImageInput(thumbnailUrl, "Course thumbnail");
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid course thumbnail.",
    });
  }

  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      title,
      description,
      thumbnailUrl: normalizedThumbnailUrl,
      status,
      instructorId: req.session.role === "ADMIN" ? instructorId ?? course.instructorId : course.instructorId,
    },
  });

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
