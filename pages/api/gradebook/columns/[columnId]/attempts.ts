import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const columnId = String(req.query.columnId ?? "");
  const { studentId, attemptId } = req.body as {
    studentId?: string;
    attemptId?: string;
  };

  if (!columnId || !studentId || !attemptId) {
    return res.status(400).json({ error: "columnId, studentId, and attemptId are required." });
  }

  const column = await prisma.gradebookColumn.findFirst({
    where: {
      id: columnId,
      type: "QUIZ",
      course: req.session.role === "ADMIN" ? undefined : getManagedCourseWhere(req.session),
    },
  });

  if (!column || !column.sourceId) {
    return res.status(404).json({ error: "Quiz gradebook column not found." });
  }

  const attempt = await prisma.quizAttempt.findFirst({
    where: {
      id: attemptId,
      quizId: column.sourceId,
      studentId,
      isSubmitted: true,
    },
  });

  if (!attempt) {
    return res.status(404).json({ error: "Quiz attempt not found." });
  }

  const cell = await prisma.gradebookCell.upsert({
    where: {
      columnId_studentId: {
        columnId,
        studentId,
      },
    },
    update: {
      score: attempt.score ?? null,
      selectedQuizAttemptId: attempt.id,
      selectedAssignmentSubmissionId: null,
    },
    create: {
      courseId: column.courseId,
      columnId,
      studentId,
      score: attempt.score ?? null,
      selectedQuizAttemptId: attempt.id,
    },
  });

  return res.status(200).json({ cell });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
