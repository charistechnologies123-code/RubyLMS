import type { GradebookColumnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCourseAttendanceSessionDates, normalizeAttendanceDays } from "@/lib/attendance";

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

function roundGradebookScore(score: number) {
  return Math.round((score + Number.EPSILON) * 100) / 100;
}

function hasPositiveScore(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalizeImportedScore(args: {
  rawScore: number | null | undefined;
  targetMaxScore: number | null | undefined;
  sourceMaxScore?: number | null | undefined;
}) {
  const { rawScore, targetMaxScore, sourceMaxScore } = args;

  if (typeof rawScore !== "number" || Number.isNaN(rawScore)) {
    return null;
  }

  if (!hasPositiveScore(targetMaxScore)) {
    return rawScore;
  }

  if (hasPositiveScore(sourceMaxScore)) {
    return roundGradebookScore((rawScore / sourceMaxScore) * targetMaxScore);
  }

  if (rawScore > targetMaxScore) {
    return roundGradebookScore((rawScore / 100) * targetMaxScore);
  }

  return rawScore;
}

function getQuizSourceMaxScore(quiz: {
  totalMarks: number | null;
  quizQuestions: Array<{
    marksOverride: number | null;
    questionBank: {
      marks: number;
    };
  }>;
}) {
  if (hasPositiveScore(quiz.totalMarks)) {
    return quiz.totalMarks;
  }

  const totalFromQuestions = quiz.quizQuestions.reduce((sum, question) => {
    const marks = question.marksOverride ?? question.questionBank.marks;
    return sum + (Number.isFinite(marks) ? marks : 0);
  }, 0);

  return hasPositiveScore(totalFromQuestions) ? totalFromQuestions : null;
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

async function getEnrolledStudentIds(courseId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { studentId: true },
  });

  return enrollments.map((enrollment) => enrollment.studentId);
}

export async function syncCourseGradebook(courseId: string) {
  const [columns, studentIds] = await Promise.all([
    prisma.gradebookColumn.findMany({
      where: { courseId },
      include: { cells: true },
    }),
    getEnrolledStudentIds(courseId),
  ]);

  if (!columns.length || !studentIds.length) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const column of columns) {
      const existingStudentIds = new Set(column.cells.map((cell) => cell.studentId));

      for (const studentId of studentIds) {
        if (existingStudentIds.has(studentId)) {
          continue;
        }

        await tx.gradebookCell.create({
          data: {
            courseId,
            columnId: column.id,
            studentId,
          },
        });
      }
    }
  });
}

export async function createGradebookColumn(args: {
  courseId: string;
  title: string;
  type?: "CUSTOM" | "ATTENDANCE" | "QUIZ" | "ASSIGNMENT";
  maxScore?: number | null;
  createdById?: string | null;
  sourceId?: string | null;
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
      sourceId: args.sourceId ?? null,
      order,
      maxScore: typeof args.maxScore === "number" ? args.maxScore : null,
    },
  });

  const studentIds = await getEnrolledStudentIds(args.courseId);

  if (studentIds.length) {
    await prisma.gradebookCell.createMany({
      data: studentIds.map((studentId) => ({
        courseId: args.courseId,
        columnId: column.id,
        studentId,
      })),
      skipDuplicates: true,
    });
  }

  return column;
}

export async function importGradebookColumnFromQuiz(args: {
  courseId: string;
  columnId: string;
  quizId: string;
}) {
  const [column, quiz, studentIds, attempts] = await Promise.all([
    prisma.gradebookColumn.findUnique({
      where: { id: args.columnId },
      select: { maxScore: true },
    }),
    prisma.quiz.findUnique({
      where: { id: args.quizId },
      select: {
        totalMarks: true,
        quizQuestions: {
          select: {
            marksOverride: true,
            questionBank: {
              select: {
                marks: true,
              },
            },
          },
        },
      },
    }),
    getEnrolledStudentIds(args.courseId),
    prisma.quizAttempt.findMany({
      where: {
        quizId: args.quizId,
        isSubmitted: true,
      },
      orderBy: [{ studentId: "asc" }, { score: "desc" }, { submittedAt: "desc" }],
    }),
  ]);

  const targetMaxScore = column?.maxScore ?? null;
  const sourceMaxScore = quiz ? getQuizSourceMaxScore(quiz) : null;

  const bestAttemptByStudent = new Map<string, (typeof attempts)[number]>();

  for (const attempt of attempts) {
    if (!bestAttemptByStudent.has(attempt.studentId)) {
      bestAttemptByStudent.set(attempt.studentId, attempt);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const studentId of studentIds) {
      const attempt = bestAttemptByStudent.get(studentId) ?? null;

      await tx.gradebookCell.upsert({
        where: {
          columnId_studentId: {
            columnId: args.columnId,
            studentId,
          },
        },
        update: {
          score: normalizeImportedScore({
            rawScore: attempt?.score,
            targetMaxScore,
            sourceMaxScore,
          }),
          selectedQuizAttemptId: attempt?.id ?? null,
          selectedAssignmentSubmissionId: null,
        },
        create: {
          courseId: args.courseId,
          columnId: args.columnId,
          studentId,
          score: normalizeImportedScore({
            rawScore: attempt?.score,
            targetMaxScore,
            sourceMaxScore,
          }),
          selectedQuizAttemptId: attempt?.id ?? null,
        },
      });
    }
  });
}

export async function importGradebookColumnFromAssignment(args: {
  courseId: string;
  columnId: string;
  assignmentId: string;
}) {
  const [column, studentIds, submissions] = await Promise.all([
    prisma.gradebookColumn.findUnique({
      where: { id: args.columnId },
      select: { maxScore: true },
    }),
    getEnrolledStudentIds(args.courseId),
    prisma.assignmentSubmission.findMany({
      where: {
        assignmentId: args.assignmentId,
        score: {
          not: null,
        },
      },
      orderBy: [{ studentId: "asc" }, { gradedAt: "desc" }, { submittedAt: "desc" }],
    }),
  ]);

  const targetMaxScore = column?.maxScore ?? null;

  const bestSubmissionByStudent = new Map<string, (typeof submissions)[number]>();

  for (const submission of submissions) {
    if (!bestSubmissionByStudent.has(submission.studentId)) {
      bestSubmissionByStudent.set(submission.studentId, submission);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const studentId of studentIds) {
      const submission = bestSubmissionByStudent.get(studentId) ?? null;

      await tx.gradebookCell.upsert({
        where: {
          columnId_studentId: {
            columnId: args.columnId,
            studentId,
          },
        },
        update: {
          score: normalizeImportedScore({
            rawScore: submission?.score,
            targetMaxScore,
          }),
          selectedQuizAttemptId: null,
          selectedAssignmentSubmissionId: submission?.id ?? null,
        },
        create: {
          courseId: args.courseId,
          columnId: args.columnId,
          studentId,
          score: normalizeImportedScore({
            rawScore: submission?.score,
            targetMaxScore,
          }),
          selectedAssignmentSubmissionId: submission?.id ?? null,
        },
      });
    }
  });
}


export async function syncCourseAttendanceGradebook(courseId: string, studentId?: string) {
  const [course, columns] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        attendanceDays: true,
        startDate: true,
        durationWeeks: true,
        enrollments: {
          where: studentId ? { studentId } : undefined,
          select: { studentId: true },
        },
      },
    }),
    prisma.gradebookColumn.findMany({
      where: {
        courseId,
        type: "ATTENDANCE",
        sourceId: courseId,
      },
      select: {
        id: true,
        maxScore: true,
      },
    }),
  ]);

  if (!course || !columns.length || !course.startDate || !course.durationWeeks) {
    return;
  }

  const scheduledDates = getCourseAttendanceSessionDates(
    normalizeAttendanceDays(course.attendanceDays),
    course.startDate,
    course.durationWeeks,
  );
  const totalScheduledDays = scheduledDates.length;
  const studentIds = course.enrollments.map((enrollment) => enrollment.studentId);

  if (!studentIds.length) {
    return;
  }

  const records = totalScheduledDays
    ? await prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          clockInAt: { not: null },
          clockOutAt: { not: null },
          session: {
            courseId,
            sessionDate: { in: scheduledDates },
          },
        },
        select: {
          studentId: true,
          sessionId: true,
        },
      })
    : [];
  const attendedSessionsByStudent = new Map<string, Set<string>>();

  for (const record of records) {
    const attendedSessions = attendedSessionsByStudent.get(record.studentId) ?? new Set<string>();
    attendedSessions.add(record.sessionId);
    attendedSessionsByStudent.set(record.studentId, attendedSessions);
  }

  await prisma.$transaction(async (tx) => {
    for (const column of columns) {
      for (const enrolledStudentId of studentIds) {
        const attendedDays = attendedSessionsByStudent.get(enrolledStudentId)?.size ?? 0;
        const score =
          totalScheduledDays > 0 && hasPositiveScore(column.maxScore)
            ? roundGradebookScore((attendedDays / totalScheduledDays) * column.maxScore)
            : null;

        await tx.gradebookCell.upsert({
          where: {
            columnId_studentId: {
              columnId: column.id,
              studentId: enrolledStudentId,
            },
          },
          update: {
            score,
            notes: `${attendedDays} of ${totalScheduledDays} attendance days completed`,
            selectedQuizAttemptId: null,
            selectedAssignmentSubmissionId: null,
          },
          create: {
            courseId,
            columnId: column.id,
            studentId: enrolledStudentId,
            score,
            notes: `${attendedDays} of ${totalScheduledDays} attendance days completed`,
          },
        });
      }
    }
  });
}

export async function importGradebookColumnFromAttendance(args: {
  courseId: string;
  columnId: string;
}) {
  const column = await prisma.gradebookColumn.findFirst({
    where: {
      id: args.columnId,
      courseId: args.courseId,
      type: "ATTENDANCE",
    },
    select: {
      id: true,
      maxScore: true,
    },
  });

  if (!column || !hasPositiveScore(column.maxScore)) {
    throw new Error("Set a positive obtainable grade before importing attendance.");
  }

  await prisma.gradebookColumn.update({
    where: { id: column.id },
    data: { sourceId: args.courseId },
  });

  await syncCourseAttendanceGradebook(args.courseId);
}
export async function clearGradebookStudentScore(args: {
  courseId: string;
  columnId: string;
  studentId: string;
}) {
  await prisma.gradebookCell.upsert({
    where: {
      columnId_studentId: {
        columnId: args.columnId,
        studentId: args.studentId,
      },
    },
    update: {
      score: null,
      selectedQuizAttemptId: null,
      selectedAssignmentSubmissionId: null,
    },
    create: {
      courseId: args.courseId,
      columnId: args.columnId,
      studentId: args.studentId,
      score: null,
    },
  });
}
