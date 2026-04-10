import type { Prisma } from "@prisma/client";

export function generateStudentId(fullName: string, count: number) {
  const initials = fullName
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);

  return `RBY-${initials || "STD"}-${String(count + 1).padStart(4, "0")}`;
}

export const userSummarySelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  avatarUrl: true,
  studentId: true,
  archivedAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
