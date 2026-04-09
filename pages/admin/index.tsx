import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import { formatShortDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN"], async () => {
    const [users, courses, assignments, notifications, logs] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.course.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          instructor: {
            select: { fullName: true },
          },
        },
      }),
      prisma.assignment.findMany({
        orderBy: { dueAt: "asc" },
        take: 5,
        include: { course: true },
      }),
      prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          actor: {
            select: { fullName: true },
          },
        },
      }),
    ]);

    return {
      users: serialize(users),
      courses: serialize(courses),
      assignments: serialize(assignments),
      notifications: serialize(notifications),
      logs: serialize(logs),
      stats: {
        users: users.length,
        publishedCourses: courses.filter((course) => course.status === "PUBLISHED").length,
        openAssignments: assignments.length,
        unreadNotifications: notifications.filter((notification) => !notification.isRead).length,
      },
    };
  });
}

export default function AdminDashboard({
  session,
  stats,
  users,
  courses,
  assignments,
  logs,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role="ADMIN"
      session={session}
      title="Admin Command Center"
      description="Oversee users, publishing, enrollments, notifications, and audit-ready platform activity."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active views" value={stats.users} helper="Recently created accounts" />
        <StatCard label="Published courses" value={stats.publishedCourses} helper="Courses live for learners" />
        <StatCard label="Assignments due" value={stats.openAssignments} helper="Current tracked assignment records" />
        <StatCard
          label="Unread notifications"
          value={stats.unreadNotifications}
          helper="In-app system notices"
          accent="red"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Recent Users" subtitle="Admins are responsible for creating and maintaining accounts.">
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-[22px] border border-[#efe6ff] bg-[#fcfbff] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-950">{user.fullName}</p>
                  <p className="text-sm text-slate-600">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={user.role === "ADMIN" ? "purple" : user.role === "INSTRUCTOR" ? "green" : "slate"}>
                    {user.role}
                  </Badge>
                  <Badge tone={user.status === "ACTIVE" ? "green" : "red"}>{user.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Audit Snapshot" subtitle="Latest high-accountability platform activity.">
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-[22px] bg-[#faf7ff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{log.action.replaceAll("_", " ")}</p>
                  <span className="text-xs text-slate-500">{formatShortDate(log.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{log.details || `${log.targetType} updated`}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {log.actor.fullName}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Latest Courses">
          <div className="space-y-3">
            {courses.map((course) => (
              <article key={course.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{course.title}</p>
                  <Badge tone={course.status === "PUBLISHED" ? "green" : "purple"}>{course.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{course.description}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Instructor: {course.instructor?.fullName ?? "Unassigned"}
                </p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Assignment Watchlist">
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-[22px] bg-[#fff7f7] p-4">
                <p className="font-semibold text-slate-950">{assignment.title}</p>
                <p className="mt-1 text-sm text-slate-600">{assignment.course.title}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#b42323]">
                  Due {formatShortDate(assignment.dueAt)}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardLayout>
  );
}
