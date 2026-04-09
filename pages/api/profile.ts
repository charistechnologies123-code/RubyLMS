import type { NextApiResponse } from "next";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalizeAvatarInput } from "@/lib/avatar";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { setSessionCookie, signSessionToken } from "@/lib/auth";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        studentId: true,
        lastLoginAt: true,
      },
    });

    return res.status(200).json({ user });
  }

  if (req.method === "PATCH") {
    const { password, avatarUrl } = req.body as {
      password?: string;
      avatarUrl?: string;
    };

    if (!password?.trim() && typeof avatarUrl === "undefined") {
      return res.status(400).json({ error: "Nothing to update." });
    }

    let normalizedAvatarUrl: string | null | undefined;

    try {
      normalizedAvatarUrl = normalizeAvatarInput(avatarUrl);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid avatar.",
      });
    }

    const user = await prisma.user.update({
      where: { id: req.session.userId },
      data: {
        avatarUrl: normalizedAvatarUrl,
        passwordHash: password?.trim() ? await bcrypt.hash(password, 10) : undefined,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        studentId: true,
        lastLoginAt: true,
      },
    });

    await createAuditLog({
      actorId: req.session.userId,
      action: "PROFILE_UPDATED",
      targetType: "User",
      targetId: req.session.userId,
      details: "Updated own profile",
    });

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

    return res.status(200).json({ user });
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
