import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students can update lesson progress." });
  }

  const { lessonId, completed } = req.body as {
    lessonId?: string;
    completed?: string | boolean;
  };

  if (!lessonId) {
    return res.status(400).json({ error: "lessonId is required." });
  }

  const progress = await prisma.lessonProgress.upsert({
    where: {
      lessonId_studentId: {
        lessonId,
        studentId: req.session.userId,
      },
    },
    update: {
      completed: completed === true || completed === "true",
      completedAt: completed === true || completed === "true" ? new Date() : null,
    },
    create: {
      lessonId,
      studentId: req.session.userId,
      completed: completed === true || completed === "true",
      completedAt: completed === true || completed === "true" ? new Date() : null,
    },
  });

  return res.status(200).json({ progress });
}

export default withApiAuth(handler, ["STUDENT"]);
