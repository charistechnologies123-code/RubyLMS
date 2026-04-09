import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, signSessionToken } from "@/lib/auth";

type LoginRole = "STUDENT" | "INSTRUCTOR" | "ADMIN";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, role } = req.body as {
    email?: string;
    password?: string;
    role?: LoginRole;
  };

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password, and role are required." });
  }

  const user =
    role === "STUDENT"
      ? await prisma.user.findFirst({
          where: {
            role: "STUDENT",
            OR: [{ email }, { studentId: email }],
          },
        })
      : await prisma.user.findFirst({
          where: {
            email,
            role,
          },
        });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  if (user.status !== "ACTIVE") {
    return res.status(403).json({ error: "This account is inactive." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signSessionToken({
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
  });

  setSessionCookie(res, token);

  return res.status(200).json({
    role: user.role,
    fullName: user.fullName,
  });
}
