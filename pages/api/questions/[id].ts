import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const questionId = String(req.query.id);

  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    include: { course: true },
  });

  if (!question) {
    return res.status(404).json({ error: "Question not found." });
  }

  if (!canManageCourse(req.session, question.course.instructorId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.courseQuestion.delete({
    where: { id: questionId },
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "COURSE_QUESTION_DELETED",
    targetType: "CourseQuestion",
    targetId: questionId,
    details: `Deleted question ${question.title}`,
  });

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
