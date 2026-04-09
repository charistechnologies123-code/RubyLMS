import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { formatDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN"], async () => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    return { logs: serialize(logs) };
  });
}

export default function AuditLogsPage({
  session,
  logs,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role="ADMIN"
      session={session}
      title="Audit Logs"
      description="Track admin-accountable changes across users, courses, enrollments, and learning content."
    >
      <Panel title="Recent Activity">
        {!logs.length ? (
          <EmptyState title="No audit logs yet" description="Administrative actions will be recorded here." />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{log.targetType}</Badge>
                  <Badge tone="slate">{log.targetId || "No target ID"}</Badge>
                </div>
                <p className="mt-3 font-semibold text-slate-950">{log.action.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm text-slate-600">{log.details || "No extra details recorded."}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {log.actor.fullName} ({log.actor.email}) • {formatDate(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}
