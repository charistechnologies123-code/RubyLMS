import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { clearGradebookStudentScore } from "@/lib/gradebook";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const columnId = String(req.query.columnId ?? "");
  const studentId = String(req.query.studentId ?? "");

  if (!columnId || !studentId) {
    return res.status(400).json({ error: "columnId and studentId are required." });
  }

  const column = await prisma.gradebookColumn.findFirst({
    where: {
      id: columnId,
      course: req.session.role === "ADMIN" ? undefined : getManagedCourseWhere(req.session),
    },
  });

  if (!column) {
    return res.status(404).json({ error: "Gradebook column not found." });
  }

  await clearGradebookStudentScore({
    courseId: column.courseId,
    columnId,
    studentId,
  });

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
