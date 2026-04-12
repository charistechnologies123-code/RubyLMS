import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getRequiredSeconds, calculateCourseProgress } from "@/lib/courseProgress";
import { notifyUsers } from "@/lib/notifications";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students can update page progress." });
  }

  const { lessonPageId, secondsSpent, markDone } = req.body as {
    lessonPageId?: string;
    secondsSpent?: string | number;
    markDone?: string | boolean;
  };

  if (!lessonPageId) {
    return res.status(400).json({ error: "lessonPageId is required." });
  }

  const page = await prisma.lessonPage.findFirst({
    where: {
      id: lessonPageId,
      lesson: {
        status: "PUBLISHED",
        course: {
          status: "PUBLISHED",
          enrollments: {
            some: {
              studentId: req.session.userId,
            },
          },
        },
      },
    },
    include: {
      lesson: {
        include: {
          course: true,
        },
      },
      progress: {
        where: {
          studentId: req.session.userId,
        },
        take: 1,
      },
    },
  });

  if (!page) {
    return res.status(404).json({ error: "Module page not found." });
  }

  const incrementValue =
    typeof secondsSpent === "number" ? secondsSpent : typeof secondsSpent === "string" && secondsSpent.length ? Number(secondsSpent) : 0;
  const safeIncrement = Number.isFinite(incrementValue) ? Math.max(0, Math.min(300, Math.round(incrementValue))) : 0;
  const shouldMarkDone = markDone === true || markDone === "true";
  const existingProgress = page.progress[0] ?? null;
  const nextTimeSpentSeconds = (existingProgress?.timeSpentSeconds ?? 0) + safeIncrement;
  const requiredSeconds = getRequiredSeconds(page.estimatedDurationMinutes);

  if (shouldMarkDone && nextTimeSpentSeconds < requiredSeconds) {
    return res.status(400).json({
      error: "Please spend the required time on this page before marking it as done.",
      progress: {
        timeSpentSeconds: nextTimeSpentSeconds,
        requiredSeconds,
        completed: existingProgress?.completed ?? false,
      },
    });
  }

  const progress = await prisma.lessonPageProgress.upsert({
    where: {
      lessonPageId_studentId: {
        lessonPageId,
        studentId: req.session.userId,
      },
    },
    update: {
      timeSpentSeconds: nextTimeSpentSeconds,
      completed: shouldMarkDone ? true : existingProgress?.completed ?? false,
      completedAt:
        shouldMarkDone && !(existingProgress?.completed ?? false)
          ? new Date()
          : existingProgress?.completedAt ?? null,
    },
    create: {
      lessonPageId,
      studentId: req.session.userId,
      timeSpentSeconds: nextTimeSpentSeconds,
      completed: shouldMarkDone,
      completedAt: shouldMarkDone ? new Date() : null,
    },
  });

  const [totalPages, completedPages] = await Promise.all([
    prisma.lessonPage.count({
      where: {
        lesson: {
          courseId: page.lesson.courseId,
          status: "PUBLISHED",
          course: {
            status: "PUBLISHED",
          },
        },
      },
    }),
    prisma.lessonPageProgress.count({
      where: {
        studentId: req.session.userId,
        completed: true,
        lessonPage: {
          lesson: {
            courseId: page.lesson.courseId,
            status: "PUBLISHED",
            course: {
              status: "PUBLISHED",
            },
          },
        },
      },
    }),
  ]);

  const courseProgress = calculateCourseProgress(completedPages, totalPages);

  if (shouldMarkDone && courseProgress.totalPages > 0 && courseProgress.completedPages >= courseProgress.totalPages) {
    const title = "Course completed";
    const message = `Congratulations ${req.session.fullName}, you have successfully completed the ${page.lesson.course.title} course.`;
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: req.session.userId,
        title,
        message,
      },
      select: {
        id: true,
      },
    });

    if (!existingNotification) {
      await notifyUsers([req.session.userId], title, message);
    }
  }

  return res.status(200).json({
    progress: {
      id: progress.id,
      timeSpentSeconds: progress.timeSpentSeconds,
      completed: progress.completed,
      completedAt: progress.completedAt,
      requiredSeconds,
    },
    courseProgress,
  });
}

export default withApiAuth(handler, ["STUDENT"]);
