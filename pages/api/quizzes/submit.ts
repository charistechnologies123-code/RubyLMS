import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students can submit quizzes." });
  }

  const { quizId, attemptId, answers } = req.body as {
    quizId?: string;
    attemptId?: string;
    answers?: Array<{ quizQuestionId: string; selectedOptionId?: string }>;
  };

  if (!quizId || !Array.isArray(answers)) {
    return res.status(400).json({ error: "quizId and answers are required." });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      quizQuestions: {
        include: {
          questionBank: {
            include: {
              options: true,
            },
          },
        },
      },
      course: true,
    },
  });

  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found." });
  }

  const attempt =
    attemptId
      ? await prisma.quizAttempt.findFirst({
          where: {
            id: attemptId,
            quizId,
            studentId: req.session.userId,
          },
        })
      : null;

  if (!attempt) {
    return res.status(400).json({ error: "Quiz attempt not found. Reopen the quiz and try again." });
  }

  if (attempt.isSubmitted) {
    return res.status(400).json({ error: "This attempt was already submitted." });
  }

  if (new Date() > attempt.expiresAt) {
    return res.status(400).json({ error: "Time is up for this attempt." });
  }

  const score = quiz.quizQuestions.reduce((total, question) => {
    const correctOptionIds = question.questionBank.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id)
      .sort();

    const selectedIds = answers
      .filter((answer) => answer.quizQuestionId === question.id && answer.selectedOptionId)
      .map((answer) => answer.selectedOptionId as string)
      .sort();

    const isCorrect =
      correctOptionIds.length === selectedIds.length &&
      correctOptionIds.every((optionId, index) => optionId === selectedIds[index]);

    const marks = question.marksOverride ?? question.questionBank.marks;
    return total + (isCorrect ? marks : 0);
  }, 0);

  const submittedAttempt = await prisma.$transaction(async (tx) => {
    await tx.quizAnswer.deleteMany({
      where: {
        attemptId: attempt.id,
      },
    });

    return tx.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        isSubmitted: true,
        score,
        answers: {
          create: answers.map((answer) => ({
            quizQuestionId: answer.quizQuestionId,
            selectedOptionId: answer.selectedOptionId || null,
          })),
        },
      },
      include: {
        answers: true,
      },
    });
  });

  await notifyUsers(
    [quiz.createdById],
    "Quiz submitted",
    `${req.session.fullName} completed ${quiz.title}.`,
  );

  return res.status(200).json({
    attempt: submittedAttempt,
    score: quiz.showScoreImmediately ? score : null,
    submitted: true,
  });
}

export default withApiAuth(handler, ["STUDENT"]);
