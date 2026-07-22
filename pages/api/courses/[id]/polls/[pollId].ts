import type { NextApiResponse } from "next";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

function normalizeList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

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
      options: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!poll) {
    return res.status(404).json({ error: "Poll not found." });
  }

  if (req.session.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage polls." });
  }

  if (req.method === "PATCH") {
    const { title, description, status, closesAt, optionLabels, slotCounts } = req.body as {
      title?: string;
      description?: string;
      status?: "DRAFT" | "OPEN" | "CLOSED";
      closesAt?: string | null;
      optionLabels?: string | string[];
      slotCounts?: string | string[];
    };

    const labels = normalizeList(optionLabels).map((value) => value.trim()).filter(Boolean);
    const slots = normalizeList(slotCounts)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const hasOptionEdits = labels.length > 0 || slots.length > 0;
    const voteCount = await prisma.pollVote.count({ where: { pollId: poll.id } });

    if (hasOptionEdits) {
      if (labels.length < 2 || labels.length !== slots.length) {
        return res.status(400).json({ error: "Provide at least two poll options with slot counts." });
      }

      if (voteCount > 0 && labels.length !== poll.options.length) {
        return res.status(400).json({ error: "You cannot add or remove options after voting has started." });
      }

      await prisma.$transaction(async (tx) => {
        await tx.poll.update({
          where: { id: poll.id },
          data: {
            title: title?.trim() || poll.title,
            description: typeof description === "string" ? description.trim() || null : poll.description,
            status: status ?? poll.status,
            closesAt: typeof closesAt === "string" ? new Date(closesAt) : closesAt === null ? null : poll.closesAt,
          },
        });

        const existingOptions = [...poll.options].sort((left, right) => left.order - right.order);
        const existingOptionIds = new Set(existingOptions.map((option) => option.id));
        const nextOptionIds = new Set<string>();

        for (let index = 0; index < labels.length; index += 1) {
          const label = labels[index];
          const slotsTotal = slots[index];
          const existingOption = existingOptions[index];

          if (existingOption) {
            nextOptionIds.add(existingOption.id);
            await tx.pollOption.update({
              where: { id: existingOption.id },
              data: {
                label,
                slotsTotal,
                order: index + 1,
              },
            });
            continue;
          }

          await tx.pollOption.create({
            data: {
              pollId: poll.id,
              label,
              slotsTotal,
              order: index + 1,
            },
          });
        }

        if (voteCount === 0 && labels.length < existingOptions.length) {
          await tx.pollOption.deleteMany({
            where: {
              pollId: poll.id,
              id: {
                notIn: Array.from(nextOptionIds),
              },
            },
          });
        }
      });
    } else {
      await prisma.poll.update({
        where: { id: poll.id },
        data: {
          title: title?.trim() || poll.title,
          description: typeof description === "string" ? description.trim() || null : poll.description,
          status: status ?? poll.status,
          closesAt: typeof closesAt === "string" ? new Date(closesAt) : closesAt === null ? null : poll.closesAt,
        },
      });
    }

    const updatedPoll = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "POLL_UPDATED",
      targetType: "Poll",
      targetId: poll.id,
      details: `Updated poll ${updatedPoll?.title ?? poll.title}`,
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
