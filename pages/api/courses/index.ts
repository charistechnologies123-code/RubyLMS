import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeImageInput } from "@/lib/media";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { normalizeManagerIds } from "@/lib/courseManagers";
import { getVisibleCourseWhere } from "@/lib/lms";
import { slugify } from "@/lib/slug";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const courses = await prisma.course.findMany({
      where: getVisibleCourseWhere(req.session),
      orderBy: { createdAt: "desc" },
      include: {
        instructor: {
          select: {
            id: true,
            fullName: true,
          },
        },
        lessons: {
          orderBy: { order: "asc" },
        },
        assignments: true,
        quizzes: true,
        resources: true,
        announcements: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        questions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            answers: true,
          },
        },
        enrollments: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                email: true,
                studentId: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ courses });
  }

  if (req.method === "POST") {
    if (req.session.role === "STUDENT") {
      return res.status(403).json({ error: "Only admins and instructors can create courses." });
    }

    const { title, description, thumbnailUrl, status, instructorId, managerIds } = req.body as {
      title?: string;
      description?: string;
      thumbnailUrl?: string;
      status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      instructorId?: string;
      managerIds?: string | string[];
    };

    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required." });
    }

    let normalizedThumbnailUrl: string | null | undefined;

    try {
      normalizedThumbnailUrl = normalizeImageInput(thumbnailUrl, "Course thumbnail");
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid course thumbnail.",
      });
    }

    const normalizedManagerIds = normalizeManagerIds(managerIds);

    const slugBase = slugify(title);
    const slugCount = await prisma.course.count({
      where: {
        slug: {
          startsWith: slugBase,
        },
      },
    });

    const course = await prisma.course.create({
      data: {
        title,
        description,
        thumbnailUrl: normalizedThumbnailUrl ?? null,
        status: status ?? "DRAFT",
        slug: slugCount ? `${slugBase}-${slugCount + 1}` : slugBase,
        createdById: req.session.userId,
        instructorId:
          req.session.role === "INSTRUCTOR" ? req.session.userId : instructorId || null,
        courseManagers:
          req.session.role === "ADMIN" && normalizedManagerIds.length
            ? {
                create: normalizedManagerIds.map((userId) => ({
                  userId,
                })),
              }
            : undefined,
      },
      include: {
        instructor: {
          select: {
            fullName: true,
          },
        },
      },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "COURSE_CREATED",
      targetType: "Course",
      targetId: course.id,
      details: `Created course ${course.title}`,
    });

    return res.status(201).json({ course });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
