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

  if (!courseId) {
    return res.status(400).json({ error: "courseId is required." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(req.session.role === "ADMIN"
        ? {}
        : {
            status: "PUBLISHED",
            enrollments: {
              some: {
                studentId: req.session.userId,
              },
            },
          }),
    },
    select: {
      id: true,
      title: true,
      createdById: true,
      instructorId: true,
      courseManagers: {
        select: { userId: true },
      },
    },
  });

  if (!course) {
    return res.status(404).json({ error: "Course not found." });
  }

  if (req.method === "GET") {
    const polls = await prisma.poll.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        options: {
          orderBy: { order: "asc" },
          include: {
            votes: req.session.role === "ADMIN"
              ? {
                  include: {
                    student: {
                      select: {
                        id: true,
                        fullName: true,
                        studentId: true,
                      },
                    },
                  },
                }
              : false,
          },
        },
        votes: req.session.role === "STUDENT" ? { where: { studentId: req.session.userId } } : true,
      },
    });

    return res.status(200).json({ polls });
  }

  if (req.method === "POST") {
    if (req.session.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create polls." });
    }

    const { title, description, status, closesAt, optionLabels, slotCounts } = req.body as {
      title?: string;
      description?: string;
      status?: "DRAFT" | "OPEN" | "CLOSED";
      closesAt?: string;
      optionLabels?: string | string[];
      slotCounts?: string | string[];
    };

    const labels = normalizeList(optionLabels).map((value) => value.trim()).filter(Boolean);
    const slots = normalizeList(slotCounts)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!title?.trim()) {
      return res.status(400).json({ error: "Poll title is required." });
    }

    if (labels.length < 2 || labels.length !== slots.length) {
      return res.status(400).json({ error: "Provide at least two poll options with slot counts." });
    }

    const poll = await prisma.poll.create({
      data: {
        courseId,
        createdById: req.session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        status: status ?? "OPEN",
        closesAt: closesAt ? new Date(closesAt) : null,
        options: {
          create: labels.map((label, index) => ({
            label,
            slotsTotal: slots[index] ?? 1,
            order: index + 1,
          })),
        },
      },
      include: { options: true },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "POLL_CREATED",
      targetType: "Poll",
      targetId: poll.id,
      details: `Created poll ${poll.title} for ${course.title}`,
    });

    return res.status(201).json({ poll });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "STUDENT"]);
