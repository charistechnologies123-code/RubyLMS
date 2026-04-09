import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { formatDate } from "@/lib/format";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type NotificationPageProps = {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  notification: unknown;
};

export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<NotificationPageProps>> {
  const session = getSessionFromPageContext(ctx);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  if (!assertRoleAccess(session, ["ADMIN", "INSTRUCTOR", "STUDENT"])) {
    return {
      redirect: {
        destination: getDefaultRouteForRole(session.role),
        permanent: false,
      },
    };
  }

  const notificationId = String(ctx.params?.notificationId);

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: session.userId,
    },
  });

  if (!notification) {
    return {
      props: {
        session,
        notification: null,
      },
    };
  }

  if (!notification.isRead) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
    notification.isRead = true;
  }

  return {
    props: {
      session,
      notification: serialize(notification),
    },
  };
}

export default function NotificationDetailPage({
  session,
  notification,
}: NotificationPageProps & {
  notification: {
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  } | null;
}) {
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Notification"
      description="Read the full notification details and return to your inbox when you are done."
    >
      {!notification ? (
        <Panel title="Notification">
          <EmptyState
            title="Notification not found"
            description="This notification may have been removed or may not belong to your account."
          />
        </Panel>
      ) : (
        <Panel title={notification.title}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={notification.isRead ? "slate" : "purple"}>
                {notification.isRead ? "Read" : "Unread"}
              </Badge>
            </div>
            <div className="rounded-[24px] border border-[#efe6ff] bg-white p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{notification.message}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
                {formatDate(notification.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/notifications"
                className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Back to notifications
              </Link>
            </div>
          </div>
        </Panel>
      )}
    </DashboardLayout>
  );
}
