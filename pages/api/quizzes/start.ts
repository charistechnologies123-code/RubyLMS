import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canStudentSubmitBeforeDueDate } from "@/lib/lms";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students can start quizzes." });
  }

  const { quizId } = req.body as { quizId?: string };

  if (!quizId) {
    return res.status(400).json({ error: "quizId is required." });
  }

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      status: "PUBLISHED",
      archivedAt: null,
      course: {
        status: "PUBLISHED",
        enrollments: {
          some: {
            studentId: req.session.userId,
          },
        },
      },
      OR: [{ lessonId: null }, { lesson: { status: "PUBLISHED" } }],
    },
    include: {
      attempts: {
        where: { studentId: req.session.userId },
        orderBy: { attemptNumber: "desc" },
      },
    },
  });

  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found or not available." });
  }

  if (!canStudentSubmitBeforeDueDate(quiz.dueAt)) {
    return res.status(400).json({ error: "The due date for this quiz has passed." });
  }

  const existingActiveAttempt = quiz.attempts.find(
    (attempt) => !attempt.isSubmitted && attempt.expiresAt.getTime() > Date.now(),
  );

  if (existingActiveAttempt) {
    return res.status(200).json({ attemptId: existingActiveAttempt.id });
  }

  const submittedAttempts = quiz.attempts.filter((attempt) => attempt.isSubmitted).length;

  if (submittedAttempts >= quiz.maxAttempts) {
    return res.status(400).json({ error: "You have reached the maximum number of attempts." });
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      studentId: req.session.userId,
      attemptNumber: quiz.attempts.length + 1,
      expiresAt: new Date(Date.now() + quiz.timeLimitMinutes * 60 * 1000),
    },
  });

  return res.status(200).json({ attemptId: attempt.id });
}

export default withApiAuth(handler, ["STUDENT"]);
