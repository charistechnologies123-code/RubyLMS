import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      ok: true,
      users,
    });
  } catch (error) {
    console.error("TEST_API_ERROR:", error);
    return res.status(500).json({
      ok: false,
      message: "Database connection failed",
    });
  }
}