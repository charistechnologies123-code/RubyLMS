import { prisma } from "@/lib/prisma";

export async function notifyUsers(userIds: string[], title: string, message: string) {
  const uniqueUserIds = [...new Set(userIds)];

  if (!uniqueUserIds.length) {
    return;
  }

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      title,
      message,
    })),
  });
}
