import type { NextApiResponse } from "next";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

class VoteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.session.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students can vote on polls." });
  }

  const courseId = String(req.query.id ?? "");
  const pollId = String(req.query.pollId ?? "");
  const { optionId } = req.body as { optionId?: string };

  if (!courseId || !pollId || !optionId) {
    return res.status(400).json({ error: "courseId, pollId, and optionId are required." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      status: "PUBLISHED",
      enrollments: {
        some: {
          studentId: req.session.userId,
        },
      },
    },
    select: { id: true },
  });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  const poll = await prisma.poll.findFirst({
    where: {
      id: pollId,
      courseId,
      status: "OPEN",
    },
    include: {
      options: true,
    },
  });

  if (!poll) {
    return res.status(404).json({ error: "Poll not found or not open for voting." });
  }

  if (poll.closesAt && poll.closesAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "This poll has already closed." });
  }

  const selectedOption = poll.options.find((option) => option.id === optionId);

  if (!selectedOption) {
    return res.status(404).json({ error: "Poll option not found." });
  }

  try {
    const vote = await prisma.$transaction(async (tx) => {
      const existingVote = await tx.pollVote.findUnique({
        where: {
          pollId_studentId: {
            pollId,
            studentId: req.session.userId,
          },
        },
      });

      if (existingVote) {
        throw new VoteError("You have already voted in this poll.", 409);
      }

      const capacityUpdate = await tx.pollOption.updateMany({
        where: {
          id: optionId,
          pollId,
          slotsTaken: {
            lt: selectedOption.slotsTotal,
          },
        },
        data: {
          slotsTaken: {
            increment: 1,
          },
        },
      });

      if (!capacityUpdate.count) {
        throw new VoteError("This option has no slots left.", 409);
      }

      return tx.pollVote.create({
        data: {
          pollId,
          optionId,
          studentId: req.session.userId,
        },
      });
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "POLL_VOTED",
      targetType: "Poll",
      targetId: poll.id,
      details: `Student voted in poll ${poll.title}`,
    });

    return res.status(200).json({ vote });
  } catch (error) {
    if (error instanceof VoteError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unable to submit vote." });
  }
}

export default withApiAuth(handler, ["STUDENT"]);
