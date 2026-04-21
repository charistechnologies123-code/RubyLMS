import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { normalizeImportedScore } from "@/lib/gradebook";

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
    include: {
      quiz: {
        select: {
          totalMarks: true,
          quizQuestions: {
            select: {
              marksOverride: true,
              questionBank: {
                select: {
                  marks: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    return res.status(404).json({ error: "Quiz attempt not found." });
  }

  const sourceMaxScore =
    typeof attempt.quiz.totalMarks === "number" && attempt.quiz.totalMarks > 0
      ? attempt.quiz.totalMarks
      : attempt.quiz.quizQuestions.reduce((sum, question) => {
          const marks = question.marksOverride ?? question.questionBank.marks;
          return sum + (Number.isFinite(marks) ? marks : 0);
        }, 0) || null;

  const cell = await prisma.gradebookCell.upsert({
    where: {
      columnId_studentId: {
        columnId,
        studentId,
      },
    },
    update: {
      score: normalizeImportedScore({
        rawScore: attempt.score,
        targetMaxScore: column.maxScore,
        sourceMaxScore,
      }),
      selectedQuizAttemptId: attempt.id,
      selectedAssignmentSubmissionId: null,
    },
    create: {
      courseId: column.courseId,
      columnId,
      studentId,
      score: normalizeImportedScore({
        rawScore: attempt.score,
        targetMaxScore: column.maxScore,
        sourceMaxScore,
      }),
      selectedQuizAttemptId: attempt.id,
    },
  });

  return res.status(200).json({ cell });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
