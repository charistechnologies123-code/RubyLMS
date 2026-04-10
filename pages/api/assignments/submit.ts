import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import { normalizeFileInput } from "@/lib/media";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students can submit assignments." });
  }

  const { assignmentId, fileUrl, linkUrl, textSubmission } = req.body as {
    assignmentId?: string;
    fileUrl?: string;
    linkUrl?: string;
    textSubmission?: string;
  };

  if (!assignmentId) {
    return res.status(400).json({ error: "assignmentId is required." });
  }

  let normalizedFileUrl: string | null | undefined;

  try {
    normalizedFileUrl = normalizeFileInput(fileUrl, "Submission file");
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid submission file.",
    });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });

  if (!assignment) {
    return res.status(404).json({ error: "Assignment not found." });
  }

  if (assignment.status !== "PUBLISHED") {
    return res.status(400).json({ error: "This assignment is not available for students yet." });
  }

  if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "The due date for this assignment has passed." });
  }

  const submission = await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: req.session.userId,
      },
    },
    update: {
      fileUrl: normalizedFileUrl,
      linkUrl: linkUrl || null,
      textSubmission: textSubmission || null,
      submittedAt: new Date(),
    },
    create: {
      assignmentId,
      studentId: req.session.userId,
      fileUrl: normalizedFileUrl,
      linkUrl: linkUrl || null,
      textSubmission: textSubmission || null,
    },
  });

  if (assignment.createdById !== req.session.userId) {
    await notifyUsers(
      [assignment.createdById],
      "Assignment submitted",
      `${req.session.fullName} submitted ${assignment.title}.`,
    );
  }

  return res.status(200).json({ submission });
}

export default withApiAuth(handler, ["STUDENT"]);
