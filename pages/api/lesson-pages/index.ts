import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";
import { slugify } from "@/lib/slug";
import { normalizeEmbedInput, normalizeImageInput } from "@/lib/media";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { lessonId, title, body, externalUrl, imageUrl, embedUrl } = req.body as {
    lessonId?: string;
    title?: string;
    body?: string;
    externalUrl?: string;
    imageUrl?: string;
    embedUrl?: string;
  };

  if (!lessonId || !title || !body) {
    return res.status(400).json({ error: "lessonId, title, and body are required." });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          courseManagers: true,
        },
      },
      pages: true,
    },
  });

  if (!lesson) {
    return res.status(404).json({ error: "Lesson not found." });
  }

  if (
    !canManageCourse(
      req.session,
      [lesson.course.instructorId, lesson.course.createdById, ...lesson.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
    )
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let normalizedImageUrl: string | null | undefined;
  let normalizedEmbedUrl: string | null | undefined;

  try {
    normalizedImageUrl = normalizeImageInput(imageUrl, "Module page image");
    normalizedEmbedUrl = normalizeEmbedInput(embedUrl, "Embed URL");
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid module page media.",
    });
  }

  const baseSlug = slugify(title);
  const duplicateCount = lesson.pages.filter((page) => page.slug.startsWith(baseSlug)).length;

  const page = await prisma.lessonPage.create({
    data: {
      lessonId,
      title,
      body,
      externalUrl: externalUrl?.trim() || null,
      imageUrl: normalizedImageUrl,
      embedUrl: normalizedEmbedUrl,
      order: lesson.pages.length + 1,
      slug: duplicateCount ? `${baseSlug}-${duplicateCount + 1}` : baseSlug,
    },
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "LESSON_PAGE_CREATED",
    targetType: "LessonPage",
    targetId: page.id,
    details: `Added module page ${page.title}`,
  });

  return res.status(201).json({ page });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
