import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { createGradebookColumn } from "@/lib/gradebook";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const courseId = String(req.query.courseId ?? "");
  const { title, type, maxScore } = req.body as {
    title?: string;
    type?: "CUSTOM" | "ATTENDANCE" | "QUIZ" | "ASSIGNMENT";
    maxScore?: string;
  };

  if (!courseId || !title?.trim()) {
    return res.status(400).json({ error: "courseId and title are required." });
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

  const column = await createGradebookColumn({
    courseId,
    title: title.trim(),
    type:
      type === "ATTENDANCE" || type === "QUIZ" || type === "ASSIGNMENT"
        ? type
        : "CUSTOM",
    maxScore: maxScore?.length ? Number(maxScore) : null,
    createdById: req.session.userId,
  });

  return res.status(201).json({ column });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
