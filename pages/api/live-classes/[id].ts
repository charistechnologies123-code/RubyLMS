import type { NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageLiveClass, isLiveClassJoinable } from "@/lib/liveClasses";
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

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  try {
    const liveClassId = String(req.query.id ?? "");

    const liveClass = await prisma.liveClass.findUnique({
      where: { id: liveClassId },
      include: liveClassInclude,
    });

    if (!liveClass) {
      return res.status(404).json({ error: "Live class not found." });
    }

    const isMember = liveClass.course.enrollments.some((enrollment) => enrollment.studentId === req.session.userId);
    const isManager = canManageLiveClass(req.session, liveClass.course);
    const isJoinAllowed = isLiveClassJoinable(liveClass);

    if (req.method === "GET") {
      if (!isMember && !isManager && req.session.role !== "ADMIN") {
        return res.status(403).json({ error: "You do not have access to this live class." });
      }

      return res.status(200).json({
        liveClass,
        canJoin: isMember && isJoinAllowed,
        canManage: isManager || req.session.role === "ADMIN",
      });
    }

    if (req.method === "PATCH") {
      if (!isManager && req.session.role !== "ADMIN") {
        return res.status(403).json({ error: "Only course instructors, managers, and admins can update live classes." });
      }

      const { title, description, startsAt, endsAt, status, allowChat } = req.body as {
        title?: string;
        description?: string;
        startsAt?: string;
        endsAt?: string;
        status?: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
        allowChat?: boolean;
      };

      const startsAtDate = startsAt ? new Date(startsAt) : null;
      const endsAtDate = endsAt ? new Date(endsAt) : null;

      if (startsAtDate && Number.isNaN(startsAtDate.getTime())) {
        return res.status(400).json({ error: "Invalid startsAt value." });
      }

      if (endsAtDate && Number.isNaN(endsAtDate.getTime())) {
        return res.status(400).json({ error: "Invalid endsAt value." });
      }

      if (startsAtDate && endsAtDate && endsAtDate <= startsAtDate) {
        return res.status(400).json({ error: "endsAt must be after startsAt." });
      }

      const updatedLiveClass = await prisma.liveClass.update({
        where: { id: liveClassId },
        data: {
          title: title?.trim(),
          description: typeof description === "string" ? description.trim() || null : undefined,
          startsAt: startsAtDate ?? undefined,
          endsAt: endsAtDate ?? undefined,
          status,
          allowChat,
        },
        include: liveClassInclude,
      });

      return res.status(200).json({ liveClass: updatedLiveClass });
    }

    if (req.method === "DELETE") {
      if (!isManager && req.session.role !== "ADMIN") {
        return res.status(403).json({ error: "Only course instructors, managers, and admins can cancel live classes." });
      }

      await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { status: "CANCELLED" },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load the live class right now.",
    });
  }
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);

