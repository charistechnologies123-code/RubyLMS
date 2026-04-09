import type { NextApiResponse } from "next";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeAvatarInput } from "@/lib/avatar";
import { setSessionCookie, signSessionToken } from "@/lib/auth";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { userSummarySelect } from "@/lib/users";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const userId = String(req.query.id);

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    return res.status(404).json({ error: "User not found." });
  }

  if (req.method === "DELETE") {
    if (userId === req.session.userId) {
      return res.status(400).json({ error: "You cannot delete your own admin account." });
    }

    const dependencies = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: {
            createdCourses: true,
            assignmentCreated: true,
            quizCreated: true,
            announcements: true,
          },
        },
      },
    });

    const blockingItems = [
      { label: "created courses", count: dependencies?._count.createdCourses ?? 0 },
      { label: "assignments", count: dependencies?._count.assignmentCreated ?? 0 },
      { label: "quizzes", count: dependencies?._count.quizCreated ?? 0 },
      { label: "announcements", count: dependencies?._count.announcements ?? 0 },
    ].filter((item) => item.count > 0);

    if (blockingItems.length > 0) {
      return res.status(409).json({
        error: `This user cannot be deleted until their owned records are reassigned or removed: ${blockingItems
          .map((item) => `${item.count} ${item.label}`)
          .join(", ")}.`,
      });
    }

    await prisma.user.delete({ where: { id: userId } });

    await createAuditLog({
      actorId: req.session.userId,
      action: "USER_DELETED",
      targetType: "User",
      targetId: existingUser.id,
      details: `Deleted ${existingUser.email}`,
    });

    return res.status(200).json({ success: true });
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fullName, email, password, role, status, avatarUrl, studentId } = req.body as {
    fullName?: string;
    email?: string;
    password?: string;
    role?: "ADMIN" | "INSTRUCTOR" | "STUDENT";
    status?: "ACTIVE" | "INACTIVE";
    avatarUrl?: string;
    studentId?: string;
  };

  let normalizedAvatarUrl: string | null | undefined;

  try {
    normalizedAvatarUrl = normalizeAvatarInput(avatarUrl);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid avatar.",
    });
  }

  const nextRole = role ?? existingUser.role;
  const normalizedEmail = email?.trim() ?? existingUser.email;
  const normalizedStudentId =
    nextRole === "STUDENT" ? studentId?.trim() ?? existingUser.studentId : null;

  const conflictingUser = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [
        { email: normalizedEmail },
        ...(normalizedStudentId ? [{ studentId: normalizedStudentId }] : []),
      ],
    },
    select: { id: true },
  });

  if (conflictingUser) {
    return res.status(409).json({ error: "A user with that email or student ID already exists." });
  }

  const data = {
    fullName: fullName?.trim() || existingUser.fullName,
    email: normalizedEmail,
    role: nextRole,
    status: status ?? existingUser.status,
    avatarUrl: normalizedAvatarUrl,
    studentId: normalizedStudentId,
    passwordHash: password?.trim() ? await bcrypt.hash(password, 10) : undefined,
  };

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: userSummarySelect,
  });

  await createAuditLog({
    actorId: req.session.userId,
    action: "USER_UPDATED",
    targetType: "User",
    targetId: user.id,
    details: `Updated ${user.email}`,
  });

  if (user.id === req.session.userId) {
    setSessionCookie(
      res,
      signSessionToken({
        userId: user.id,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
      }),
    );
  }

  return res.status(200).json({ user });
}

export default withApiAuth(handler, ["ADMIN"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
