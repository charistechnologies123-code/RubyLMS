import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withApiAuth, type AuthedNextApiRequest } from "@/lib/api";
import { getManagedCourseWhere } from "@/lib/courseManagers";

async function handler(req: AuthedNextApiRequest, res: NextApiResponse) {
  const columnId = String(req.query.columnId ?? "");

  if (!columnId) {
    return res.status(400).json({ error: "columnId is required." });
  }

  const column = await prisma.gradebookColumn.findFirst({
    where: {
      id: columnId,
      course: req.session.role === "ADMIN" ? undefined : getManagedCourseWhere(req.session),
    },
  });

  if (!column) {
    return res.status(404).json({ error: "Gradebook column not found." });
  }

  if (req.method === "PATCH") {
    const { title, maxScore, includeInTotals } = req.body as {
      title?: string;
      maxScore?: string;
      includeInTotals?: string | boolean;
    };

    const updatedColumn = await prisma.gradebookColumn.update({
      where: { id: columnId },
      data: {
        title:
          column.type === "CUSTOM" || column.type === "ATTENDANCE"
            ? title?.trim() || column.title
            : undefined,
        maxScore: maxScore === "" || typeof maxScore === "undefined" ? null : Number(maxScore),
        includeInTotals: includeInTotals === true || includeInTotals === "true",
      },
    });

    return res.status(200).json({ column: updatedColumn });
  }

  if (req.method === "DELETE") {
    if (column.type !== "CUSTOM" && column.type !== "ATTENDANCE") {
      return res.status(400).json({ error: "Only attendance and custom columns can be deleted." });
    }

    await prisma.gradebookColumn.delete({
      where: { id: columnId },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withApiAuth(handler, ["ADMIN", "INSTRUCTOR"]);
