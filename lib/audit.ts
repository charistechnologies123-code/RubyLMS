import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: string | null;
};

export async function createAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: input,
  });
}
