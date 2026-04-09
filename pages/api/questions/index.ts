import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const where =
      req.session.role === "STUDENT"
        ? {
            course: {
              enrollments: {
                some: {
                  studentId: req.session.userId,
                },
              },
            },
          }
        : req.session.role === "INSTRUCTOR"
          ? {
              course: {
                OR: [{ instructorId: req.session.userId }, { createdById: req.session.userId }],
              },
            }
          : {};

    const questions = await prisma.courseQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        course: true,
        askedBy: {
          select: {
            fullName: true,
            role: true,
          },
        },
        answers: {
          orderBy: { createdAt: "asc" },
          include: {
            answeredBy: {
              select: {
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ questions });
  }

  if (req.method === "POST") {
    if (req.session.role !== "STUDENT") {
      return res.status(403).json({ error: "Only students can ask questions." });
    }

    const { courseId, title, content } = req.body as {
      courseId?: string;
      title?: string;
      content?: string;
    };

    if (!courseId || !title || !content) {
      return res.status(400).json({ error: "courseId, title, and content are required." });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });

    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }

    const question = await prisma.courseQuestion.create({
      data: {
        courseId,
        title,
        content,
        askedById: req.session.userId,
      },
    });

    const notifyIds = [course.createdById, course.instructorId].filter(Boolean) as string[];
    await notifyUsers(notifyIds, "New course question", `${req.session.fullName} asked: ${title}`);

    return res.status(201).json({ question });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR", "STUDENT"]);
