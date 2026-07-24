import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import {
  importGradebookColumnFromAssignment,
  importGradebookColumnFromAttendance,
  importGradebookColumnFromQuiz,
  syncCourseGradebook,
} from "@/lib/gradebook";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const columnId = String(req.query.columnId ?? "");
  const { importType, sourceId } = req.body as {
    importType?: "QUIZ" | "ASSIGNMENT" | "ATTENDANCE";
    sourceId?: string;
  };

  if (!columnId || !importType || !["QUIZ", "ASSIGNMENT", "ATTENDANCE"].includes(importType) || (importType !== "ATTENDANCE" && !sourceId)) {
    return res.status(400).json({ error: "A valid import type and source are required." });
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

  await syncCourseGradebook(column.courseId);


  if (importType === "ATTENDANCE") {
    if (column.type !== "ATTENDANCE") {
      return res.status(400).json({ error: "Attendance can only be imported into an attendance column." });
    }

    try {
      await importGradebookColumnFromAttendance({
        courseId: column.courseId,
        columnId,
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unable to import attendance.",
      });
    }

    return res.status(200).json({ success: true });
  }

  if (!sourceId) {
    return res.status(400).json({ error: "A source is required." });
  }
  if (importType === "QUIZ") {
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: sourceId,
        courseId: column.courseId,
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found in this course." });
    }

    await importGradebookColumnFromQuiz({
      courseId: column.courseId,
      columnId,
      quizId: sourceId,
    });

    return res.status(200).json({ success: true });
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: sourceId,
      courseId: column.courseId,
    },
  });

  if (!assignment) {
    return res.status(404).json({ error: "Assignment not found in this course." });
  }

  await importGradebookColumnFromAssignment({
    courseId: column.courseId,
    columnId,
    assignmentId: sourceId,
  });

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
