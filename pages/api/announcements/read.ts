import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { announcementId } = req.body as {
    announcementId?: string;
  };

  if (!announcementId) {
    return res.status(400).json({ error: "announcementId is required." });
  }

  const announcement = await prisma.announcement.findFirst({
    where: {
      id: announcementId,
      ...(req.session.role === "STUDENT"
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
          : {}),
    },
    select: {
      id: true,
    },
  });

  if (!announcement) {
    return res.status(404).json({ error: "Announcement not found." });
  }

  const read = await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId,
        userId: req.session.userId,
      },
    },
    update: {},
    create: {
      announcementId,
      userId: req.session.userId,
    },
  });

  return res.status(200).json({ read });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
