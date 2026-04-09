import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.session.userId,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    });
  }

  if (req.method === "POST") {
    const { notificationId } = req.body as { notificationId?: string };

    if (!notificationId) {
      await prisma.notification.updateMany({
        where: { userId: req.session.userId, isRead: false },
        data: { isRead: true },
      });

      return res.status(200).json({ success: true, unreadCount: 0 });
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.session.userId, isRead: false },
    });

    return res.status(200).json({ notification, unreadCount });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
