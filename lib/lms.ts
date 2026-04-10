import type { SessionUser } from "@/lib/auth";
import { getManagedCourseWhere } from "@/lib/courseManagers";

export function getVisibleCourseWhere(session: SessionUser) {
  if (session.role === "STUDENT") {
    return {
      status: "PUBLISHED" as const,
      enrollments: {
        some: {
          studentId: session.userId,
        },
      },
    };
  }

  if (session.role === "INSTRUCTOR") {
    return getManagedCourseWhere(session);
  }

  return {};
}

export function getVisibleLessonWhere(session: SessionUser) {
  if (session.role === "STUDENT") {
    return {
      status: "PUBLISHED" as const,
      course: {
        status: "PUBLISHED" as const,
        enrollments: {
          some: {
            studentId: session.userId,
          },
        },
      },
    };
  }

  if (session.role === "INSTRUCTOR") {
    return {
      course: {
        ...getManagedCourseWhere(session),
      },
    };
  }

  return {};
}

export function getVisibleAssignmentWhere(session: SessionUser) {
  if (session.role === "STUDENT") {
    return {
      status: "PUBLISHED" as const,
      course: {
        status: "PUBLISHED" as const,
        enrollments: {
          some: {
            studentId: session.userId,
          },
        },
      },
      OR: [{ lessonId: null }, { lesson: { status: "PUBLISHED" as const } }],
    };
  }

  if (session.role === "INSTRUCTOR") {
    return {
      course: {
        ...getManagedCourseWhere(session),
      },
    };
  }

  return {};
}

export function getVisibleQuizWhere(session: SessionUser) {
  if (session.role === "STUDENT") {
    return {
      status: "PUBLISHED" as const,
      archivedAt: null,
      course: {
        status: "PUBLISHED" as const,
        enrollments: {
          some: {
            studentId: session.userId,
          },
        },
      },
      OR: [{ lessonId: null }, { lesson: { status: "PUBLISHED" as const } }],
    };
  }

  if (session.role === "INSTRUCTOR") {
    return {
      archivedAt: null,
      course: {
        ...getManagedCourseWhere(session),
      },
    };
  }

  return {};
}

export function canStudentSubmitBeforeDueDate(dueAt: Date | null) {
  return !dueAt || dueAt.getTime() >= Date.now();
}
