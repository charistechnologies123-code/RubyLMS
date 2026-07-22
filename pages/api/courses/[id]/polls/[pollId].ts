import type { NextApiResponse } from "next";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const courseId = String(req.query.id ?? "");
  const pollId = String(req.query.pollId ?? "");

  if (!courseId || !pollId) {
    return res.status(400).json({ error: "courseId and pollId are required." });
  }

  const poll = await prisma.poll.findFirst({
    where: {
      id: pollId,
      courseId,
    },
    include: {
      options: true,
    },
  });

  if (!poll) {
    return res.status(404).json({ error: "Poll not found." });
  }

  if (req.session.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage polls." });
  }

  if (req.method === "PATCH") {
    const { title, description, status, closesAt } = req.body as {
      title?: string;
      description?: string;
      status?: "DRAFT" | "OPEN" | "CLOSED";
      closesAt?: string | null;
    };

    const updatedPoll = await prisma.poll.update({
      where: { id: poll.id },
      data: {
        title: title?.trim() || poll.title,
        description: typeof description === "string" ? description.trim() || null : poll.description,
        status: status ?? poll.status,
        closesAt: typeof closesAt === "string" ? new Date(closesAt) : closesAt === null ? null : poll.closesAt,
      },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "POLL_UPDATED",
      targetType: "Poll",
      targetId: poll.id,
      details: `Updated poll ${updatedPoll.title}`,
    });

    return res.status(200).json({ poll: updatedPoll });
  }

  if (req.method === "DELETE") {
    await prisma.poll.delete({ where: { id: poll.id } });

    await createAuditLog({
      actorId: req.session.userId,
      action: "POLL_DELETED",
      targetType: "Poll",
      targetId: poll.id,
      details: `Deleted poll ${poll.title}`,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN"]);
