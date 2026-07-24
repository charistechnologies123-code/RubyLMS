import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeFileInput } from "@/lib/media";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";
import { parseLmsDateTimeLocalValue } from "@/lib/lmsTime";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const assignmentId = String(req.query.id ?? "");

  if (!assignmentId) {
    return res.status(400).json({ error: "Assignment id is required." });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        include: {
          courseManagers: true,
        },
      },
    },
  });

  if (!assignment) {
    return res.status(404).json({ error: "Assignment not found." });
  }

  if (
    !canManageCourse(
      req.session,
      [assignment.course.instructorId, assignment.course.createdById, ...assignment.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
    )
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, description, instructions, attachmentUrl, dueAt, submissionType, status } = req.body as {
    title?: string;
    description?: string;
    instructions?: string;
    attachmentUrl?: string;
    dueAt?: string;
    submissionType?: "FILE" | "LINK" | "TEXT";
    status?: "DRAFT" | "PUBLISHED";
  };

  let normalizedAttachmentUrl: string | null | undefined;

  try {
    normalizedAttachmentUrl = normalizeFileInput(attachmentUrl, "Assignment attachment");
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid assignment attachment.",
    });
  }

  const updatedAssignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title: title ?? undefined,
      description: description ?? undefined,
      instructions: typeof instructions === "undefined" ? undefined : instructions || null,
      attachmentUrl: normalizedAttachmentUrl,
      dueAt: dueAt ? parseLmsDateTimeLocalValue(dueAt) : dueAt === "" ? null : undefined,
      submissionType: submissionType ?? undefined,
      status: status ?? undefined,
    },
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "ASSIGNMENT_UPDATED",
    targetType: "Assignment",
    targetId: assignmentId,
    details: `Updated assignment ${updatedAssignment.title}`,
  });

  return res.status(200).json({ assignment: updatedAssignment });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);

