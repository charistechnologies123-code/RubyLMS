import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";
import { slugify } from "@/lib/slug";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseId, title, content, status } = req.body as {
    courseId?: string;
    title?: string;
    content?: string;
    status?: "DRAFT" | "PUBLISHED";
  };

  if (!courseId || !title || !content) {
    return res.status(400).json({ error: "courseId, title, and content are required." });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { lessons: true, courseManagers: true },
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

  const baseSlug = slugify(title);
  const duplicateCount = course.lessons.filter((lesson) => lesson.slug.startsWith(baseSlug)).length;

  const lesson = await prisma.lesson.create({
    data: {
      courseId,
      title,
      content,
      status: status ?? "PUBLISHED",
      order: course.lessons.length + 1,
      slug: duplicateCount ? `${baseSlug}-${duplicateCount + 1}` : baseSlug,
    },
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "LESSON_CREATED",
    targetType: "Lesson",
    targetId: lesson.id,
    details: `Added lesson ${lesson.title}`,
  });

  return res.status(201).json({ lesson });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
