import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { canManageCourse } from "@/lib/permissions";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const announcementId = String(req.query.id);

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { course: true },
  });

  if (!announcement) {
    return res.status(404).json({ error: "Announcement not found." });
  }

  if (!canManageCourse(req.session, announcement.course.instructorId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.announcement.delete({
    where: { id: announcementId },
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "ANNOUNCEMENT_DELETED",
    targetType: "Announcement",
    targetId: announcementId,
    details: `Deleted announcement ${announcement.title}`,
  });

  return res.status(200).json({ success: true });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
