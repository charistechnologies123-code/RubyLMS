import type { GradebookColumnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CsvImportRecord =
  | {
      mode: "entry";
      studentId: string;
      title: string;
      score: number;
      maxScore: number | null;
    }
  | {
      mode: "matrix";
      studentId: string;
      scores: Array<{
        title: string;
        score: number | null;
      }>;
    };

function sanitizeKeyPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildColumnKey(type: GradebookColumnType, title: string, sourceId?: string | null) {
  if (sourceId) {
    return `${type.toLowerCase()}:${sourceId}`;
  }

  const safeTitle = sanitizeKeyPart(title) || "item";
  return `${type.toLowerCase()}:${safeTitle}`;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseGradeCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [] satisfies CsvImportRecord[];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  if (
    headers.length >= 4 &&
    headers[0]?.toLowerCase() === "studentid" &&
    headers[1]?.toLowerCase() === "title" &&
    headers[2]?.toLowerCase() === "score"
  ) {
    return lines.slice(1).map((line) => {
      const [studentId, title, score, maxScore] = parseCsvLine(line);

      return {
        mode: "entry" as const,
        studentId,
        title,
        score: Number(score),
        maxScore: maxScore ? Number(maxScore) : null,
      };
    });
  }

  const scoreHeaders = headers.slice(1);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const studentId = values[0] ?? "";

    return {
      mode: "matrix" as const,
      studentId,
      scores: scoreHeaders.map((title, index) => {
        const rawValue = values[index + 1];

        return {
          title,
          score: rawValue && rawValue.length ? Number(rawValue) : null,
        };
      }),
    };
  });
}

function calculateQuizMaxScore(quiz: {
  totalMarks: number | null;
  quizQuestions: Array<{ marksOverride: number | null; questionBank: { marks: number } }>;
}) {
  if (typeof quiz.totalMarks === "number") {
    return quiz.totalMarks;
  }

  return quiz.quizQuestions.reduce(
    (total, question) => total + (question.marksOverride ?? question.questionBank.marks ?? 1),
    0,
  );
}

function buildSummaryMap<T extends { studentId: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const existing = grouped.get(item.studentId) ?? [];
    existing.push(item);
    grouped.set(item.studentId, existing);
  }

  return grouped;
}

export async function syncCourseGradebook(courseId: string) {
  const [
    enrollments,
    quizzes,
    assignments,
    legacyEntries,
    existingColumns,
  ] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentId: true,
          },
        },
      },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.quiz.findMany({
      where: { courseId },
      include: {
        quizQuestions: {
          include: {
            questionBank: {
              select: {
                marks: true,
              },
            },
          },
        },
        attempts: {
          where: { isSubmitted: true },
          orderBy: [{ studentId: "asc" }, { score: "desc" }, { submittedAt: "desc" }],
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assignment.findMany({
      where: { courseId },
      include: {
        submissions: {
          where: {
            score: {
              not: null,
            },
          },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.gradebookEntry.findMany({
      where: {
        courseId,
        sourceType: "MANUAL",
      },
      orderBy: [{ title: "asc" }, { studentId: "asc" }],
    }),
    prisma.gradebookColumn.findMany({
      where: { courseId },
      include: {
        cells: true,
      },
      orderBy: { order: "asc" },
    }),
  ]);

  const studentIds = enrollments.map((enrollment) => enrollment.studentId);
  const existingColumnByKey = new Map(existingColumns.map((column) => [column.key, column]));
  const legacyByTitle = new Map<string, (typeof legacyEntries)>();

  for (const entry of legacyEntries) {
    const entries = legacyByTitle.get(entry.title) ?? [];
    entries.push(entry);
    legacyByTitle.set(entry.title, entries);
  }

  const plannedColumns = [
    {
      key: buildColumnKey("ATTENDANCE", "Attendance"),
      title: "Attendance",
      type: "ATTENDANCE" as const,
      sourceId: null,
      maxScore: existingColumnByKey.get(buildColumnKey("ATTENDANCE", "Attendance"))?.maxScore ?? 100,
    },
    ...quizzes.map((quiz) => ({
      key: buildColumnKey("QUIZ", quiz.title, quiz.id),
      title: quiz.title,
      type: "QUIZ" as const,
      sourceId: quiz.id,
      maxScore: calculateQuizMaxScore(quiz),
    })),
    ...assignments.map((assignment) => ({
      key: buildColumnKey("ASSIGNMENT", assignment.title, assignment.id),
      title: assignment.title,
      type: "ASSIGNMENT" as const,
      sourceId: assignment.id,
      maxScore:
        existingColumnByKey.get(buildColumnKey("ASSIGNMENT", assignment.title, assignment.id))?.maxScore ?? null,
    })),
    ...Array.from(legacyByTitle.entries()).map(([title, entries]) => ({
      key: buildColumnKey("CUSTOM", title),
      title,
      type: "CUSTOM" as const,
      sourceId: null,
      maxScore: entries.find((entry) => typeof entry.maxScore === "number")?.maxScore ?? null,
    })),
  ];

  let nextOrder = existingColumns.reduce((maxOrder, column) => Math.max(maxOrder, column.order), 0);

  await prisma.$transaction(async (tx) => {
    for (const plannedColumn of plannedColumns) {
      const existingColumn = existingColumnByKey.get(plannedColumn.key);

      if (existingColumn) {
        await tx.gradebookColumn.update({
          where: { id: existingColumn.id },
          data: {
            title: plannedColumn.title,
            type: plannedColumn.type,
            sourceId: plannedColumn.sourceId,
            maxScore: plannedColumn.maxScore ?? existingColumn.maxScore,
          },
        });
        continue;
      }

      nextOrder += 1;

      const createdColumn = await tx.gradebookColumn.create({
        data: {
          courseId,
          createdById: null,
          key: plannedColumn.key,
          title: plannedColumn.title,
          type: plannedColumn.type,
          sourceId: plannedColumn.sourceId,
          order: nextOrder,
          maxScore: plannedColumn.maxScore,
        },
      });

      existingColumnByKey.set(plannedColumn.key, {
        ...createdColumn,
        cells: [],
      } as typeof existingColumns[number]);
    }

    const columns = await tx.gradebookColumn.findMany({
      where: { courseId },
      include: { cells: true },
      orderBy: { order: "asc" },
    });

    for (const column of columns) {
      const existingCellByStudent = new Map(column.cells.map((cell) => [cell.studentId, cell]));

      for (const studentId of studentIds) {
        if (!existingCellByStudent.has(studentId)) {
          const createdCell = await tx.gradebookCell.create({
            data: {
              courseId,
              columnId: column.id,
              studentId,
            },
          });
          existingCellByStudent.set(studentId, createdCell);
        }
      }

      if (column.type === "QUIZ" && column.sourceId) {
        const quiz = quizzes.find((item) => item.id === column.sourceId);

        if (!quiz) {
          continue;
        }

        const attemptsByStudent = buildSummaryMap(quiz.attempts);

        for (const studentId of studentIds) {
          const attempts = attemptsByStudent.get(studentId) ?? [];
          const existingCell = existingCellByStudent.get(studentId);
          const selectedAttempt =
            attempts.find((attempt) => attempt.id === existingCell?.selectedQuizAttemptId) ?? attempts[0] ?? null;

          await tx.gradebookCell.update({
            where: {
              columnId_studentId: {
                columnId: column.id,
                studentId,
              },
            },
            data: {
              score: selectedAttempt?.score ?? null,
              selectedQuizAttemptId: selectedAttempt?.id ?? null,
              selectedAssignmentSubmissionId: null,
            },
          });
        }
      }

      if (column.type === "ASSIGNMENT" && column.sourceId) {
        const assignment = assignments.find((item) => item.id === column.sourceId);

        if (!assignment) {
          continue;
        }

        const submissionByStudent = new Map(assignment.submissions.map((submission) => [submission.studentId, submission]));

        for (const studentId of studentIds) {
          const submission = submissionByStudent.get(studentId) ?? null;

          await tx.gradebookCell.update({
            where: {
              columnId_studentId: {
                columnId: column.id,
                studentId,
              },
            },
            data: {
              score: submission?.score ?? null,
              selectedQuizAttemptId: null,
              selectedAssignmentSubmissionId: submission?.id ?? null,
            },
          });
        }
      }

      if (column.type === "CUSTOM") {
        const legacyRows = legacyByTitle.get(column.title) ?? [];

        for (const row of legacyRows) {
          await tx.gradebookCell.update({
            where: {
              columnId_studentId: {
                columnId: column.id,
                studentId: row.studentId,
              },
            },
            data: {
              score: row.score,
            },
          });
        }
      }
    }
  });
}

export async function createGradebookColumn(args: {
  courseId: string;
  title: string;
  type?: "CUSTOM" | "ATTENDANCE";
  maxScore?: number | null;
  createdById?: string | null;
}) {
  const existingColumns = await prisma.gradebookColumn.findMany({
    where: { courseId: args.courseId },
    orderBy: { order: "asc" },
  });

  const order = existingColumns.reduce((maxOrder, column) => Math.max(maxOrder, column.order), 0) + 1;
  const baseKey = buildColumnKey(args.type ?? "CUSTOM", args.title);
  let key = baseKey;
  let suffix = 2;

  while (existingColumns.some((column) => column.key === key)) {
    key = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  const column = await prisma.gradebookColumn.create({
    data: {
      courseId: args.courseId,
      createdById: args.createdById ?? null,
      title: args.title,
      key,
      type: args.type ?? "CUSTOM",
      order,
      maxScore: typeof args.maxScore === "number" ? args.maxScore : null,
    },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: args.courseId },
    select: { studentId: true },
  });

  if (enrollments.length) {
    await prisma.gradebookCell.createMany({
      data: enrollments.map((enrollment) => ({
        courseId: args.courseId,
        columnId: column.id,
        studentId: enrollment.studentId,
      })),
      skipDuplicates: true,
    });
  }

  return column;
}
