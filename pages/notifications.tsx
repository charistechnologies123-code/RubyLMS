import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import MarkAllReadButton from "@/components/ui/MarkAllReadButton";
import Panel from "@/components/ui/Panel";
import { formatDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    });

    return { notifications: serialize(notifications) };
  });
}

export default function NotificationsPage({
  session,
  notifications,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Notifications"
      description="Read course activity alerts, grading updates, announcements, and responses to your learning actions."
      actions={<MarkAllReadButton />}
    >
      <Panel title="Inbox">
        {!notifications.length ? (
          <EmptyState title="No notifications yet" description="Platform alerts will land here as you use Ruby LMS." />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={`/notifications/${notification.id}`}
                className="block rounded-[24px] border border-[#efe6ff] bg-white p-4 transition hover:border-[#d9c2ff] hover:shadow-[0_16px_40px_rgba(107,0,255,0.08)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={notification.isRead ? "slate" : "purple"}>
                      {notification.isRead ? "Read" : "Unread"}
                    </Badge>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b00ff]">
                    Open notification
                  </span>
                </div>
                <p className="mt-3 font-semibold text-slate-950">{notification.title}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{notification.message}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {formatDate(notification.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}
