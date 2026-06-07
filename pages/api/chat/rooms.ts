import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: req.session.userId,
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
          },
        },
        members: {
          include: {
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
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ rooms });
  }

  if (req.method === "POST") {
    const { type, title, memberIds, recipientId } = req.body as {
      type?: "DIRECT" | "GROUP";
      title?: string;
      memberIds?: string[] | string;
      recipientId?: string;
    };

    const requestedMemberIds = Array.isArray(memberIds)
      ? memberIds
      : typeof memberIds === "string"
        ? [memberIds]
        : [];

    const cleanedMemberIds = Array.from(
      new Set(
        [recipientId, ...requestedMemberIds]
          .filter((memberId): memberId is string => typeof memberId === "string" && memberId.trim().length > 0)
          .map((memberId) => memberId.trim())
          .filter((memberId) => memberId !== req.session.userId),
      ),
    );

    if (type === "DIRECT") {
      if (cleanedMemberIds.length !== 1) {
        return res.status(400).json({ error: "Select exactly one person for a private chat." });
      }

      const otherUserId = cleanedMemberIds[0];
      const candidateRooms = await prisma.chatRoom.findMany({
        where: {
          type: "DIRECT",
          members: {
            some: {
              userId: req.session.userId,
            },
          },
        },
        include: {
          members: true,
        },
      });

      const existingRoom = candidateRooms.find((room) => {
        const memberIdsInRoom = room.members.map((member) => member.userId).sort();
        const expectedMemberIds = [req.session.userId, otherUserId].sort();
        return memberIdsInRoom.length === 2 && memberIdsInRoom[0] === expectedMemberIds[0] && memberIdsInRoom[1] === expectedMemberIds[1];
      });

      if (existingRoom) {
        return res.status(200).json({ room: existingRoom });
      }

      const room = await prisma.chatRoom.create({
        data: {
          type: "DIRECT",
          title: null,
          createdById: req.session.userId,
          members: {
            create: [
              { userId: req.session.userId },
              { userId: otherUserId },
            ],
          },
        },
      });

      return res.status(201).json({ room });
    }

    if (type === "GROUP") {
      if (!title || !cleanedMemberIds.length) {
        return res.status(400).json({ error: "Group chat title and members are required." });
      }

      const room = await prisma.chatRoom.create({
        data: {
          type: "GROUP",
          title: title.trim(),
          createdById: req.session.userId,
          members: {
            create: [
              { userId: req.session.userId },
              ...cleanedMemberIds.map((userId) => ({ userId })),
            ],
          },
        },
      });

      return res.status(201).json({ room });
    }

    return res.status(400).json({ error: "Invalid chat room type." });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
