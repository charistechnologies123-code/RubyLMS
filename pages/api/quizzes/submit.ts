import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import { canStudentSubmitBeforeDueDate } from "@/lib/lms";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

type SubmittedAnswer = {
  quizQuestionId: string;
  selectedOptionIds?: string[];
  matchingSelections?: string[];
  textAnswer?: string;
};

type StoredQuestionData = {
  questionText?: string;
  questionType?: string;
  explanation?: string;
  answerText?: string;
  options?: Array<{ optionText: string; isCorrect: boolean }>;
  matchingPairs?: Array<{ promptText: string; answerText: string }>;
  acceptedAnswers?: string[];
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeQuestionData(questionData: unknown): StoredQuestionData {
  return typeof questionData === "object" && questionData !== null ? (questionData as StoredQuestionData) : {};
}

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
    answers?: SubmittedAnswer[];
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

  if (!canStudentSubmitBeforeDueDate(quiz.dueAt)) {
    return res.status(400).json({ error: "The due date for this quiz has passed." });
  }

  const attempt = attemptId
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

  const answersByQuestion = new Map(answers.map((answer) => [answer.quizQuestionId, answer]));

  const score = quiz.quizQuestions.reduce((total, question) => {
    const questionType = question.questionBank.questionType;
    const questionData = normalizeQuestionData(question.questionBank.questionData);
    const submittedAnswer = answersByQuestion.get(question.id);
    const marks = question.marksOverride ?? question.questionBank.marks;

    let isCorrect = false;

    if (questionType === "STRUCTURAL") {
      const acceptedAnswers = (questionData.acceptedAnswers ?? [questionData.answerText ?? ""]).map(normalizeText).filter(Boolean);
      const studentAnswer = normalizeText(submittedAnswer?.textAnswer ?? "");
      isCorrect = acceptedAnswers.length > 0 && acceptedAnswers.includes(studentAnswer);
    } else if (questionType === "MATCHING") {
      const matchingPairs = questionData.matchingPairs ?? [];
      const selectedMatches = submittedAnswer?.matchingSelections ?? [];
      isCorrect =
        matchingPairs.length > 0 &&
        matchingPairs.length === selectedMatches.length &&
        matchingPairs.every((pair, index) => normalizeText(pair.answerText) === normalizeText(selectedMatches[index] ?? ""));
    } else {
      const correctOptionIds = question.questionBank.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id)
        .sort();

      const selectedIds = (submittedAnswer?.selectedOptionIds ?? []).filter(Boolean).sort();

      isCorrect =
        correctOptionIds.length === selectedIds.length &&
        correctOptionIds.every((optionId, index) => optionId === selectedIds[index]);
    }

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
            selectedOptionId: answer.selectedOptionIds?.[0] ?? null,
            answerData: {
              selectedOptionIds: answer.selectedOptionIds ?? [],
              matchingSelections: answer.matchingSelections ?? [],
              textAnswer: answer.textAnswer ?? "",
            },
          })),
        },
      },
      include: {
        answers: true,
      },
    });
  });

  await notifyUsers([quiz.createdById], "Quiz submitted", `${req.session.fullName} completed ${quiz.title}.`);

  return res.status(200).json({
    attempt: submittedAttempt,
    score: quiz.showScoreImmediately ? score : null,
    submitted: true,
  });
}

export default withApiAuth(handler, ["STUDENT"]);
