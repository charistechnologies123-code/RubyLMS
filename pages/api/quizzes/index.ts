import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const where =
      req.session.role === "STUDENT"
        ? {
            course: {
              enrollments: {
                some: {
                  studentId: req.session.userId,
                },
              },
            },
          }
        : req.session.role === "INSTRUCTOR"
          ? {
              course: {
                OR: [{ instructorId: req.session.userId }, { createdById: req.session.userId }],
              },
            }
          : {};

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        course: true,
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
        attempts:
          req.session.role === "STUDENT"
            ? {
                where: { studentId: req.session.userId },
                orderBy: { attemptNumber: "desc" },
              }
            : false,
      },
    });

    return res.status(200).json({ quizzes });
  }

  if (req.method === "POST") {
    const {
      courseId,
      lessonId,
      title,
      description,
      instructions,
      timeLimitMinutes,
      maxAttempts,
      shuffleQuestions,
      shuffleOptions,
      showScoreImmediately,
      questions,
    } = req.body as {
      courseId?: string;
      lessonId?: string;
      title?: string;
      description?: string;
      instructions?: string;
      timeLimitMinutes?: string;
      maxAttempts?: string;
      shuffleQuestions?: string;
      shuffleOptions?: string;
      showScoreImmediately?: string;
      questions?: string;
    };

    if (!courseId || !title || !timeLimitMinutes || !questions) {
      return res.status(400).json({ error: "courseId, title, timeLimitMinutes, and questions are required." });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { enrollments: true },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }

    if (!canManageCourse(req.session, course.instructorId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsedQuestions = JSON.parse(questions) as Array<{
      questionText: string;
      questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
      marks?: number;
      explanation?: string;
      options: Array<{ optionText: string; isCorrect: boolean }>;
    }>;

    const quiz = await prisma.quiz.create({
      data: {
        courseId,
        lessonId: lessonId || null,
        title,
        description: description || null,
        instructions: instructions || null,
        createdById: req.session.userId,
        status: "PUBLISHED",
        timeLimitMinutes: Number(timeLimitMinutes),
        maxAttempts: maxAttempts ? Number(maxAttempts) : 1,
        shuffleQuestions: shuffleQuestions !== "false",
        shuffleOptions: shuffleOptions === "true",
        showScoreImmediately: showScoreImmediately !== "false",
        quizQuestions: {
          create: parsedQuestions.map((question, index) => ({
            order: index + 1,
            questionBank: {
              create: {
                courseId,
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

    await notifyUsers(
      course.enrollments.map((enrollment) => enrollment.studentId),
      "New quiz available",
      `${quiz.title} is now available in ${course.title}.`,
    );

    await createAuditLog({
      actorId: req.session.userId,
      action: "QUIZ_CREATED",
      targetType: "Quiz",
      targetId: quiz.id,
      details: `Created quiz ${quiz.title}`,
    });

    return res.status(201).json({ quiz });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
