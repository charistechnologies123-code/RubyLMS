import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { createGradebookColumn, parseGradeCsv, syncCourseGradebook } from "@/lib/gradebook";
import { readDataUrlText } from "@/lib/media";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseId, csvFile, csvText } = req.body as {
    courseId?: string;
    csvFile?: string;
    csvText?: string;
  };

  if (!courseId || (!csvFile && !csvText)) {
    return res.status(400).json({ error: "courseId and CSV data are required." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(req.session.role === "ADMIN" ? {} : getManagedCourseWhere(req.session)),
    },
    include: {
      gradebookColumns: true,
    },
  });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  await syncCourseGradebook(courseId);

  const csvSource = csvFile ? readDataUrlText(csvFile) : csvText ?? "";
  const records = parseGradeCsv(csvSource);
  const enrolledStudents = await prisma.enrollment.findMany({
    where: { courseId },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
        },
      },
    },
  });

  const studentLookup = new Map<string, string>();

  for (const enrollment of enrolledStudents) {
    studentLookup.set(enrollment.student.id, enrollment.student.id);

    if (enrollment.student.studentId) {
      studentLookup.set(enrollment.student.studentId, enrollment.student.id);
    }
  }

  const columns = await prisma.gradebookColumn.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
  });
  const columnsByTitle = new Map(columns.map((column) => [column.title.toLowerCase(), column]));

  for (const record of records) {
    const resolvedStudentId = studentLookup.get(record.studentId);

    if (!resolvedStudentId) {
      continue;
    }

    const items =
      record.mode === "entry"
        ? [
            {
              title: record.title,
              score: record.score,
              maxScore: record.maxScore,
            },
          ]
        : record.scores.map((item) => ({
            title: item.title,
            score: item.score,
            maxScore: null,
          }));

    for (const item of items) {
      let column = columnsByTitle.get(item.title.toLowerCase());

      if (!column) {
        column = await createGradebookColumn({
          courseId,
          title: item.title,
          type: item.title.toLowerCase() === "attendance" ? "ATTENDANCE" : "CUSTOM",
          maxScore: item.maxScore,
          createdById: req.session.userId,
        });
        columnsByTitle.set(column.title.toLowerCase(), column);
      } else if (typeof item.maxScore === "number" && column.maxScore == null) {
        column = await prisma.gradebookColumn.update({
          where: { id: column.id },
          data: {
            maxScore: item.maxScore,
          },
        });
        columnsByTitle.set(column.title.toLowerCase(), column);
      }

      await prisma.gradebookCell.upsert({
        where: {
          columnId_studentId: {
            columnId: column.id,
            studentId: resolvedStudentId,
          },
        },
        update: {
          score: item.score,
        },
        create: {
          courseId,
          columnId: column.id,
          studentId: resolvedStudentId,
          score: item.score,
        },
      });
    }
  }

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
