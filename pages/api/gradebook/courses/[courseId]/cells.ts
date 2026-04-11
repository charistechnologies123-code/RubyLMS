import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const courseId = String(req.query.courseId ?? "");
  const { updates } = req.body as {
    updates?: Array<{
      columnId: string;
      studentId: string;
      score: number | null;
    }>;
  };

  if (!courseId || !Array.isArray(updates)) {
    return res.status(400).json({ error: "courseId and updates are required." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(req.session.role === "ADMIN" ? {} : getManagedCourseWhere(req.session)),
    },
  });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  const editableColumns = await prisma.gradebookColumn.findMany({
    where: {
      courseId,
    },
    select: {
      id: true,
    },
  });

  const editableColumnIds = new Set(editableColumns.map((column) => column.id));

  await prisma.$transaction(
    updates
      .filter((update) => editableColumnIds.has(update.columnId))
      .map((update) =>
        prisma.gradebookCell.upsert({
          where: {
            columnId_studentId: {
              columnId: update.columnId,
              studentId: update.studentId,
            },
          },
          update: {
            score: typeof update.score === "number" && !Number.isNaN(update.score) ? update.score : null,
          },
          create: {
            courseId,
            columnId: update.columnId,
            studentId: update.studentId,
            score: typeof update.score === "number" && !Number.isNaN(update.score) ? update.score : null,
          },
        }),
      ),
  );

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
