import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const lessonId = String(req.query.id ?? "");

  if (!lessonId) {
    return res.status(400).json({ error: "Lesson id is required." });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { courseManagers: true } } },
  });

  if (!lesson) {
    return res.status(404).json({ error: "Module not found." });
  }

  if (
    !canManageCourse(
      req.session,
      [lesson.course.instructorId, lesson.course.createdById, ...lesson.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
    )
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "PATCH") {
    const { title, content, status } = req.body as {
      title?: string;
      content?: string;
      status?: "DRAFT" | "PUBLISHED";
    };

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title,
        content,
        status,
      },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "LESSON_UPDATED",
      targetType: "Lesson",
      targetId: lessonId,
      details: `Updated lesson ${updatedLesson.title}`,
    });

    return res.status(200).json({ lesson: updatedLesson });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await prisma.lesson.delete({ where: { id: lessonId } });

  await createAuditLog({
    actorId: req.session.userId,
    action: "LESSON_DELETED",
    targetType: "Lesson",
    targetId: lessonId,
    details: `Deleted lesson ${lesson.title}`,
  });

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
