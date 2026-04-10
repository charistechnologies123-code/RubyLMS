import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { syncCourseGradebook } from "@/lib/gradebook";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseId, published } = req.body as {
    courseId?: string;
    published?: string | boolean;
  };

  if (!courseId) {
    return res.status(400).json({ error: "courseId is required." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(req.session.role === "ADMIN" ? {} : getManagedCourseWhere(req.session)),
    },
  });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  await syncCourseGradebook(courseId);

  const nextPublished = published === true || published === "true";

  const publication = await prisma.gradebookPublication.upsert({
    where: { courseId },
    update: {
      publishedAt: nextPublished ? new Date() : null,
      updatedById: req.session.userId,
    },
    create: {
      courseId,
      publishedAt: nextPublished ? new Date() : null,
      updatedById: req.session.userId,
    },
  });

  return res.status(200).json({ publication });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
