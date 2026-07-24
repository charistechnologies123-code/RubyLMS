import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";
import { parseLmsDateTimeLocalValue } from "@/lib/lmsTime";

type QuizQuestionPayload = {
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "MATCHING" | "STRUCTURAL" | "TRUE_FALSE";
  marks?: number;
  explanation?: string;
  answerText?: string;
  options: Array<{ optionText: string; isCorrect: boolean }>;
  matchingPairs?: Array<{ promptText: string; answerText: string }>;
  acceptedAnswers?: string[];
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
          courseManagers: true,
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

  if (req.method === "DELETE") {
    if (
      !canManageCourse(
        req.session,
        [quiz.course.instructorId, quiz.course.createdById, ...quiz.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
      )
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!quiz.archivedAt) {
      return res.status(400).json({ error: "Archive this quiz first before deleting permanently." });
    }

    await prisma.quiz.delete({ where: { id: quizId } });

    await createAuditLog({
      actorId: req.session.userId,
      action: "QUIZ_DELETED",
      targetType: "Quiz",
      targetId: quizId,
      details: `Deleted quiz ${quiz.title}`,
    });

    return res.status(200).json({ success: true });
  }

  if (req.method === "PATCH") {
    if (
      !canManageCourse(
        req.session,
        [quiz.course.instructorId, quiz.course.createdById, ...quiz.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
      )
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      title,
      description,
      instructions,
      timeLimitMinutes,
      maxAttempts,
      status,
      dueAt,
      archived,
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
      status?: "DRAFT" | "PUBLISHED";
      dueAt?: string;
      archived?: boolean;
      questions?: string;
      showScoreImmediately?: string;
      shuffleQuestions?: string;
      shuffleOptions?: string;
    };

    if (
      typeof archived === "boolean" &&
      !title &&
      !timeLimitMinutes &&
      !questions
    ) {
      const updatedQuiz = await prisma.quiz.update({
        where: { id: quizId },
        data: {
          archivedAt: archived ? quiz.archivedAt ?? new Date() : null,
        },
      });

      await createAuditLog({
        actorId: req.session.userId,
        action: archived ? "QUIZ_ARCHIVED" : "QUIZ_RESTORED",
        targetType: "Quiz",
        targetId: quizId,
        details: `${archived ? "Archived" : "Restored"} quiz ${updatedQuiz.title}`,
      });

      return res.status(200).json({ quiz: updatedQuiz });
    }

    if (!title || !timeLimitMinutes) {
      return res.status(400).json({ error: "title and timeLimitMinutes are required." });
    }

    if (typeof archived === "boolean" && req.session.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can archive or restore quizzes." });
    }

    const parsedQuestions = parseQuestions(questions);

    if (typeof questions === "string" && !parsedQuestions?.length) {
      return res.status(400).json({ error: "At least one question is required." });
    }

    const updatedQuiz = await prisma.$transaction(async (tx) => {
      const savedQuiz = await tx.quiz.update({
        where: { id: quizId },
        data: {
          title,
          description: description || null,
          instructions: instructions || null,
          timeLimitMinutes: Number(timeLimitMinutes),
          maxAttempts: maxAttempts ? Number(maxAttempts) : 1,
          status: status ?? undefined,
          dueAt: dueAt ? parseLmsDateTimeLocalValue(dueAt) : dueAt === "" ? null : undefined,
          archivedAt:
            typeof archived === "boolean"
              ? archived
                ? quiz.archivedAt ?? new Date()
                : null
              : undefined,
          showScoreImmediately: showScoreImmediately !== "false",
          shuffleQuestions: shuffleQuestions !== "false",
          shuffleOptions: shuffleOptions === "true",
        },
      });

      if (typeof questions === "string") {
        const nonNullQuestions = parsedQuestions ?? [];

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

        for (const [index, question] of nonNullQuestions.entries()) {
          const questionBank = await tx.questionBankItem.create({
            data: {
              courseId: quiz.courseId,
              questionText: question.questionText,
              questionType: question.questionType,
              explanation: question.explanation || null,
              marks: question.marks ?? 1,
              questionData: {
                questionText: question.questionText,
                questionType: question.questionType,
                explanation: question.explanation || null,
                answerText: question.answerText || "",
                options: question.options ?? [],
                matchingPairs: question.matchingPairs ?? [],
                acceptedAnswers: question.acceptedAnswers ?? [],
              },
              options: {
                create: question.options.map((option, optionIndex) => ({
                  optionText: option.optionText,
                  isCorrect: option.isCorrect,
                  order: optionIndex + 1,
                })),
              },
            },
          });

          await tx.quizQuestion.create({
            data: {
              quizId,
              questionBankId: questionBank.id,
              order: index + 1,
            },
          });
        }
      }

      return savedQuiz;
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







