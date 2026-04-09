import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";
import { normalizeEmbedInput, normalizeImageInput } from "@/lib/media";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const pageId = String(req.query.id);

  const page = await prisma.lessonPage.findUnique({
    where: { id: pageId },
    include: {
      lesson: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!page) {
    return res.status(404).json({ error: "Module page not found." });
  }

  if (!canManageCourse(req.session, page.lesson.course.instructorId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "PATCH") {
    const { title, body, externalUrl, imageUrl, embedUrl } = req.body as {
      title?: string;
      body?: string;
      externalUrl?: string;
      imageUrl?: string;
      embedUrl?: string;
    };

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

    const updatedPage = await prisma.lessonPage.update({
      where: { id: pageId },
      data: {
        title,
        body,
        externalUrl: externalUrl?.trim() || null,
        imageUrl: normalizedImageUrl,
        embedUrl: normalizedEmbedUrl,
      },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "LESSON_PAGE_UPDATED",
      targetType: "LessonPage",
      targetId: updatedPage.id,
      details: `Updated module page ${updatedPage.title}`,
    });

    return res.status(200).json({ page: updatedPage });
  }

  if (req.method === "DELETE") {
    await prisma.lessonPage.delete({
      where: { id: pageId },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "LESSON_PAGE_DELETED",
      targetType: "LessonPage",
      targetId: pageId,
      details: `Deleted module page ${page.title}`,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
