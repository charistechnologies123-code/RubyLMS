import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const roomId = String(req.query.roomId ?? "");

  const roomMembership = await prisma.chatMember.findFirst({
    where: {
      roomId,
      userId: req.session.userId,
    },
  });

  if (!roomMembership) {
    return res.status(403).json({ error: "You do not have access to this chat room." });
  }

  if (req.method === "GET") {
    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId },
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
          orderBy: { createdAt: "asc" },
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

    if (!room) {
      return res.status(404).json({ error: "Chat room not found." });
    }

    await prisma.chatMember.update({
      where: {
        roomId_userId: {
          roomId,
          userId: req.session.userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return res.status(200).json({ room });
  }

  if (req.method === "POST") {
    const { body } = req.body as {
      body?: string;
    };

    const trimmedBody = body?.trim();

    if (!trimmedBody) {
      return res.status(400).json({ error: "Message body is required." });
    }

    const message = await prisma.$transaction(async (transaction) => {
      const createdMessage = await transaction.chatMessage.create({
        data: {
          roomId,
          senderId: req.session.userId,
          body: trimmedBody,
        },
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
      });

      await transaction.chatRoom.update({
        where: { id: roomId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      await transaction.chatMember.update({
        where: {
          roomId_userId: {
            roomId,
            userId: req.session.userId,
          },
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      return createdMessage;
    });

    return res.status(201).json({ message });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
