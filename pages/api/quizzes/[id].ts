import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

type QuizQuestionPayload = {
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  marks?: number;
  explanation?: string;
  options: Array<{ optionText: string; isCorrect: boolean }>;
};

function parseQuestions(questions?: string) {
  if (!questions) {
    return null;
  }

  return JSON.parse(questions) as QuizQuestionPayload[];
}

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const quizId = String(req.query.id ?? "");

  if (!quizId) {
    return res.status(400).json({ error: "Quiz id is required." });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: {
        include: {
          enrollments: true,
        },
      },
      quizQuestions: {
        orderBy: { order: "asc" },
        include: {
          questionBank: {
            include: {
              options: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found." });
  }

  if (req.method === "PATCH") {
    if (!canManageCourse(req.session, quiz.course.instructorId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      title,
      description,
      instructions,
      timeLimitMinutes,
      maxAttempts,
      questions,
      showScoreImmediately,
      shuffleQuestions,
      shuffleOptions,
    } = req.body as {
      title?: string;
      description?: string;
      instructions?: string;
      timeLimitMinutes?: string;
      maxAttempts?: string;
      questions?: string;
      showScoreImmediately?: string;
      shuffleQuestions?: string;
      shuffleOptions?: string;
    };

    if (!title || !timeLimitMinutes || !questions) {
      return res.status(400).json({ error: "title, timeLimitMinutes, and questions are required." });
    }

    const parsedQuestions = parseQuestions(questions);

    if (!parsedQuestions?.length) {
      return res.status(400).json({ error: "At least one question is required." });
    }

    const updatedQuiz = await prisma.$transaction(async (tx) => {
      await tx.quizAnswer.deleteMany({
        where: {
          quizQuestion: {
            quizId,
          },
        },
      });

      await tx.quizAttempt.deleteMany({
        where: { quizId },
      });

      await tx.quizQuestion.deleteMany({
        where: { quizId },
      });

      return tx.quiz.update({
        where: { id: quizId },
        data: {
          title,
          description: description || null,
          instructions: instructions || null,
          timeLimitMinutes: Number(timeLimitMinutes),
          maxAttempts: maxAttempts ? Number(maxAttempts) : 1,
          showScoreImmediately: showScoreImmediately !== "false",
          shuffleQuestions: shuffleQuestions !== "false",
          shuffleOptions: shuffleOptions === "true",
          quizQuestions: {
            create: parsedQuestions.map((question, index) => ({
              order: index + 1,
              questionBank: {
                create: {
                  courseId: quiz.courseId,
                  questionText: question.questionText,
                  questionType: question.questionType,
                  explanation: question.explanation || null,
                  marks: question.marks ?? 1,
                  options: {
                    create: question.options.map((option, optionIndex) => ({
                      optionText: option.optionText,
                      isCorrect: option.isCorrect,
                      order: optionIndex + 1,
                    })),
                  },
                },
              },
            })),
          },
        },
      });
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "QUIZ_UPDATED",
      targetType: "Quiz",
      targetId: quizId,
      details: `Updated quiz ${updatedQuiz.title}`,
    });

    return res.status(200).json({ quiz: updatedQuiz });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
