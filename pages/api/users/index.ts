import type { NextApiResponse } from "next";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeAvatarInput } from "@/lib/avatar";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { generateStudentId, userSummarySelect } from "@/lib/users";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      select: userSummarySelect,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ users });
  }

  if (req.method === "POST") {
    const { fullName, email, password, role, status, studentId, avatarUrl } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      role?: "ADMIN" | "INSTRUCTOR" | "STUDENT";
      status?: "ACTIVE" | "INACTIVE";
      studentId?: string;
      avatarUrl?: string;
    };

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: "fullName, email, password, and role are required." });
    }

    let normalizedAvatarUrl: string | null | undefined;

    try {
      normalizedAvatarUrl = normalizeAvatarInput(avatarUrl);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid avatar.",
      });
    }

    const existingConditions: Array<{ email?: string; studentId?: string }> = [{ email }];
    if (studentId) {
      existingConditions.push({ studentId });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: existingConditions,
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: "A user with that email or student ID already exists." });
    }

    const studentCount =
      role === "STUDENT" ? await prisma.user.count({ where: { role: "STUDENT" } }) : 0;

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        status: status ?? "ACTIVE",
        avatarUrl: normalizedAvatarUrl ?? null,
        studentId: role === "STUDENT" ? studentId || generateStudentId(fullName, studentCount) : null,
      },
      select: userSummarySelect,
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user.id,
      details: `Created ${role.toLowerCase()} account for ${user.email}`,
    });

    return res.status(201).json({ user });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
