import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const attemptId = String(req.query.attemptId ?? "");

  if (!attemptId) {
    return res.status(400).json({ error: "Attempt id is required." });
  }

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          course: {
            include: {
              courseManagers: true,
            },
          },
        },
      },
      student: {
        select: {
          fullName: true,
        },
      },
    },
  });

  if (!attempt) {
    return res.status(404).json({ error: "Quiz attempt not found." });
  }

  if (
    !canManageCourse(
      req.session,
      [attempt.quiz.course.instructorId, attempt.quiz.course.createdById, ...attempt.quiz.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
    )
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await prisma.quizAttempt.delete({ where: { id: attemptId } });

  await createAuditLog({
    actorId: req.session.userId,
    action: "QUIZ_ATTEMPT_DELETED",
    targetType: "QuizAttempt",
    targetId: attemptId,
    details: `Deleted attempt ${attempt.attemptNumber} for ${attempt.student.fullName} on ${attempt.quiz.title}`,
  });

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
