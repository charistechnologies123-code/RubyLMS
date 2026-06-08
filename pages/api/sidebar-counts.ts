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

  const chatRooms = await prisma.chatRoom.findMany({
    where: {
      members: {
        some: {
          userId: req.session.userId,
        },
      },
    },
    select: {
      lastMessageAt: true,
      members: {
        where: {
          userId: req.session.userId,
        },
        select: {
          lastReadAt: true,
        },
      },
    },
  });

  const unreadChatRooms = chatRooms.reduce((count, room) => {
    if (!room.lastMessageAt) {
      return count;
    }

    const lastReadAt = room.members[0]?.lastReadAt;
    if (!lastReadAt) {
      return count + 1;
    }

    return new Date(lastReadAt) < new Date(room.lastMessageAt) ? count + 1 : count;
  }, 0);

  return res.status(200).json({
    announcements: unreadAnnouncements,
    questions: unansweredQuestions,
    chat: unreadChatRooms,
  });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
