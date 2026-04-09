import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseId, lessonId, lessonPageId, title, type, fileUrl, externalUrl } = req.body as {
    courseId?: string;
    lessonId?: string;
    lessonPageId?: string;
    title?: string;
    type?: "PDF" | "DOC" | "DOCX" | "VIDEO_LINK" | "EXTERNAL_LINK" | "IMAGE" | "OTHER";
    fileUrl?: string;
    externalUrl?: string;
  };

  if (!courseId || !title || !type) {
    return res.status(400).json({ error: "courseId, title, and type are required." });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  if (!canManageCourse(req.session, course.instructorId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const resource = await prisma.resource.create({
    data: {
      courseId,
      lessonId: lessonId || null,
      lessonPageId: lessonPageId || null,
      title,
      type,
      fileUrl: fileUrl || null,
      externalUrl: externalUrl || null,
    },
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "RESOURCE_CREATED",
    targetType: "Resource",
    targetId: resource.id,
    details: `Added resource ${resource.title}`,
  });

  return res.status(201).json({ resource });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
