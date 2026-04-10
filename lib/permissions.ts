import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";

export function isAdmin(session: SessionUser | null) {
  return session?.role === "ADMIN";
}

export function isInstructor(session: SessionUser | null) {
  return session?.role === "INSTRUCTOR";
}

export function isStudent(session: SessionUser | null) {
  return session?.role === "STUDENT";
}

export function canManageUsers(session: SessionUser | null) {
  return isAdmin(session);
}

export function canManageCourse(
  session: SessionUser | null,
  instructorIdOrManagerIds?: string | string[] | null,
) {
  if (isAdmin(session)) {
    return true;
  }

  if (!session || !isInstructor(session)) {
    return false;
  }

  if (typeof instructorIdOrManagerIds === "string") {
    return instructorIdOrManagerIds === session.userId;
  }

  return Array.isArray(instructorIdOrManagerIds)
    ? instructorIdOrManagerIds.includes(session.userId)
    : false;
}

export function canEnrollStudents(session: SessionUser | null) {
  return isAdmin(session) || isInstructor(session);
}

export function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "INSTRUCTOR") return "Instructor";
  return "Student";
}
