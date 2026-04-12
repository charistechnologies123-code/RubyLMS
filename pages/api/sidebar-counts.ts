import type { NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const announcementWhere: Prisma.AnnouncementWhereInput =
    req.session.role === "STUDENT"
      ? {
          course: {
            status: "PUBLISHED",
            enrollments: {
              some: {
                studentId: req.session.userId,
              },
            },
          },
        }
      : req.session.role === "INSTRUCTOR"
        ? {
            course: getManagedCourseWhere(req.session),
          }
        : {};

  const unreadAnnouncements = await prisma.announcement.count({
    where: {
      ...announcementWhere,
      reads: {
        none: {
          userId: req.session.userId,
        },
      },
      createdById: {
        not: req.session.userId,
      },
    },
  });

  const unansweredQuestions =
    req.session.role === "STUDENT"
      ? await prisma.courseQuestion.count({
          where: {
            askedById: req.session.userId,
            answers: {
              none: {},
            },
          },
        })
      : await prisma.courseQuestion.count({
          where: {
            course: req.session.role === "ADMIN" ? undefined : getManagedCourseWhere(req.session),
            answers: {
              none: {},
            },
          },
        });

  return res.status(200).json({
    announcements: unreadAnnouncements,
    questions: unansweredQuestions,
  });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
