import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { submissionId, score, feedback } = req.body as {
    submissionId?: string;
    score?: string;
    feedback?: string;
  };

  if (!submissionId) {
    return res.status(400).json({ error: "submissionId is required." });
  }

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: { course: { include: { courseManagers: true } } },
      },
    },
  });

  if (!submission) {
    return res.status(404).json({ error: "Submission not found." });
  }

  const course = submission.assignment.course;
  if (
    req.session.role !== "ADMIN" &&
    course.instructorId !== req.session.userId &&
    course.createdById !== req.session.userId &&
    !course.courseManagers.some((manager) => manager.userId === req.session.userId)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updatedSubmission = await prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      score: typeof score === "string" && score.length ? Number(score) : null,
      feedback: feedback || null,
      gradedAt: new Date(),
    },
  });

  await notifyUsers(
    [submission.studentId],
    "Assignment graded",
    `Feedback is available for ${submission.assignment.title}.`,
  );

  return res.status(200).json({ submission: updatedSubmission });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
