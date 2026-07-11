import type { NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageLiveClass } from "@/lib/liveClasses";
import { prisma } from "@/lib/prisma";

const liveClassInclude = {
  createdBy: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      role: true,
    },
  },
  course: {
    include: {
      instructor: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          role: true,
        },
      },
      courseManagers: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
              studentId: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.LiveClassInclude;

function normalizeMeetingUrl(meetingUrl: string) {
  const trimmedMeetingUrl = meetingUrl.trim();

  if (!trimmedMeetingUrl) {
    return null;
  }

  try {
    const url = new URL(trimmedMeetingUrl);
    if (!url.protocol.startsWith("http")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const courseId = typeof req.query.courseId === "string" ? req.query.courseId : null;

      if (courseId) {
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          include: {
            instructor: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                role: true,
              },
            },
            courseManagers: {
              select: {
                userId: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    role: true,
                  },
                },
              },
            },
            enrollments: {
              include: {
                student: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    role: true,
                    studentId: true,
                  },
                },
              },
            },
            liveClasses: {
              orderBy: { startsAt: "asc" },
              include: liveClassInclude,
            },
          },
        });

        if (!course) {
          return res.status(404).json({ error: "Course not found." });
        }

        const isMember = course.enrollments.some((enrollment) => enrollment.studentId === req.session.userId);
        const isManager = canManageLiveClass(req.session, course);

        if (!isMember && !isManager && req.session.role !== "ADMIN") {
          return res.status(403).json({ error: "You do not have access to this course's live classes." });
        }

        return res.status(200).json({
          course,
          liveClasses: course.liveClasses,
        });
      }

      const liveClasses = await prisma.liveClass.findMany({
        where: {
          OR: [
            {
              course: {
                enrollments: {
                  some: {
                    studentId: req.session.userId,
                  },
                },
              },
            },
            {
              course: {
                OR: [
                  { instructorId: req.session.userId },
                  { createdById: req.session.userId },
                  { courseManagers: { some: { userId: req.session.userId } } },
                ],
              },
            },
          ],
        },
        orderBy: [{ startsAt: "asc" }],
        include: liveClassInclude,
      });

      return res.status(200).json({ liveClasses });
    }

    if (req.method === "POST") {
      const { courseId, title, description, startsAt, endsAt, meetingUrl, allowChat } = req.body as {
        courseId?: string;
        title?: string;
        description?: string;
        startsAt?: string;
        endsAt?: string;
        meetingUrl?: string;
        allowChat?: boolean;
      };

      if (!courseId || !title || !startsAt || !meetingUrl) {
        return res.status(400).json({ error: "courseId, title, startsAt, and meetingUrl are required." });
      }

      const normalizedMeetingUrl = normalizeMeetingUrl(meetingUrl);

      if (!normalizedMeetingUrl) {
        return res.status(400).json({ error: "meetingUrl must be a valid http or https URL." });
      }

      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          courseManagers: {
            select: { userId: true },
          },
        },
      });

      if (!course) {
        return res.status(404).json({ error: "Course not found." });
      }

      if (!canManageLiveClass(req.session, course)) {
        return res.status(403).json({ error: "Only course instructors, managers, and admins can schedule live classes." });
      }

      const startsAtDate = new Date(startsAt);
      const endsAtDate = endsAt ? new Date(endsAt) : null;

      if (Number.isNaN(startsAtDate.getTime())) {
        return res.status(400).json({ error: "Invalid startsAt value." });
      }

      if (endsAtDate && Number.isNaN(endsAtDate.getTime())) {
        return res.status(400).json({ error: "Invalid endsAt value." });
      }

      if (endsAtDate && endsAtDate <= startsAtDate) {
        return res.status(400).json({ error: "endsAt must be after startsAt." });
      }

      const liveClass = await prisma.liveClass.create({
        data: {
          courseId,
          title: title.trim(),
          description: description?.trim() || null,
          startsAt: startsAtDate,
          endsAt: endsAtDate,
          meetingUrl: normalizedMeetingUrl,
          allowChat: typeof allowChat === "boolean" ? allowChat : true,
          createdById: req.session.userId,
          status: startsAtDate.getTime() <= Date.now() ? "LIVE" : "SCHEDULED",
        },
        include: liveClassInclude,
      });

      return res.status(201).json({ liveClass });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load live classes right now.",
    });
  }
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
