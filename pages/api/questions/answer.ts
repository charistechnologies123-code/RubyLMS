import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role === "STUDENT") {
    return res.status(403).json({ error: "Only admins and instructors can answer questions." });
  }

  const { questionId, content } = req.body as {
    questionId?: string;
    content?: string;
  };

  if (!questionId || !content) {
    return res.status(400).json({ error: "questionId and content are required." });
  }

  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    include: { course: true },
  });

  if (!question) {
    return res.status(404).json({ error: "Question not found." });
  }

  if (
    req.session.role !== "ADMIN" &&
    question.course.instructorId !== req.session.userId &&
    question.course.createdById !== req.session.userId
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const answer = await prisma.courseQuestionAnswer.create({
    data: {
      questionId,
      content,
      answeredById: req.session.userId,
    },
  });

  await notifyUsers(
    [question.askedById],
    "Question answered",
    `${req.session.fullName} replied to your question "${question.title}".`,
  );

  return res.status(201).json({ answer });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
