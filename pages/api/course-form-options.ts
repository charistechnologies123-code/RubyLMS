import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [students, instructors] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE", archivedAt: null },
      select: { id: true, fullName: true, studentId: true },
      orderBy: { fullName: "asc" },
    }),
    req.session.role === "ADMIN"
      ? prisma.user.findMany({
          where: { role: { in: ["ADMIN", "INSTRUCTOR"] }, status: "ACTIVE", archivedAt: null },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return res.status(200).json({ students, instructors });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
