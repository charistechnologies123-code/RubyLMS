import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import { formatShortDate } from "@/lib/format";
import { formatQuizScore } from "@/lib/quizScoring";
import { getLmsDateParts } from "@/lib/lmsTime";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["STUDENT"], async (session) => {
    const [enrollments, assignments, quizAttempts, notifications, progress] = await Promise.all([
      prisma.enrollment.findMany({
        where: { studentId: session.userId },
        include: {
          course: {
            include: {
              lessons: true,
              announcements: {
                orderBy: { createdAt: "desc" },
                take: 2,
              },
              liveClasses: {
                where: { status: { in: ["SCHEDULED", "LIVE"] } },
                orderBy: { startsAt: "asc" },
                take: 3,
              },
            },
          },
        },
      }),
      prisma.assignment.findMany({
        where: {
          course: {
            enrollments: {
              some: { studentId: session.userId },
            },
          },
        },
        include: {
          course: true,
          submissions: {
            where: { studentId: session.userId },
          },
        },
        orderBy: { dueAt: "asc" },
      }),
      prisma.quizAttempt.findMany({
        where: { studentId: session.userId },
        include: {
          quiz: {
            include: {
              course: true,
              quizQuestions: {
                select: {
                  marksOverride: true,
                  questionBank: {
                    select: {
                      marks: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.lessonPageProgress.findMany({
        where: { studentId: session.userId, completed: true },
      }),
    ]);

    return {
      enrollments: serialize(enrollments),
      assignments: serialize(assignments),
      quizAttempts: serialize(quizAttempts),
      notifications: serialize(notifications),
      stats: {
        courses: enrollments.length,
        dueAssignments: assignments.filter((assignment) => !assignment.submissions.length).length,
        completedLessons: progress.length,
        quizzesTaken: quizAttempts.length,
      },
    };
  });
}

export default function StudentDashboard({
  session,
  enrollments,
  assignments,
  quizAttempts,
  notifications,
  stats,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const todayKey = (() => {
    const parts = getLmsDateParts(new Date());
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  })();
  const liveClasses = enrollments
    .flatMap((enrollment: any) => enrollment.course.liveClasses.map((liveClass: any) => ({ ...liveClass, courseTitle: enrollment.course.title })))
    .filter((liveClass: any) => {
      const parts = getLmsDateParts(new Date(liveClass.startsAt));
      const liveClassKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
      return liveClassKey === todayKey;
    });

  return (
    <DashboardLayout
      role="STUDENT"
      session={session}
      title="Student Learning Hub"
      description="Stay on top of lessons, due work, announcements, live classes, and quiz progress from one motivating workspace."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enrolled courses" value={stats.courses} helper="Your active learning spaces" />
        <StatCard label="Due assignments" value={stats.dueAssignments} helper="Assignments waiting for submission" accent="red" />
        <StatCard label="Completed pages" value={stats.completedLessons} helper="Tracked page progress" />
        <StatCard label="Quiz attempts" value={stats.quizzesTaken} helper="Recorded quiz submissions" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="My Courses">
          <div className="space-y-3">
            {enrollments.map((enrollment: any) => (
              <div key={enrollment.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{enrollment.course.title}</p>
                  <Badge tone={enrollment.course.status === "PUBLISHED" ? "green" : "purple"}>
                    {enrollment.course.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{enrollment.course.description}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {enrollment.course.lessons.length} lessons
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/courses/${enrollment.course.id}`}
                    className="rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                  >
                    Open course
                  </Link>

                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Notifications">
          <div className="space-y-3">
            {notifications.map((notification: any) => (
              <div key={notification.id} className="rounded-[22px] bg-[#faf7ff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{notification.title}</p>
                  <Badge tone={notification.isRead ? "slate" : "purple"}>
                    {notification.isRead ? "Read" : "Unread"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{notification.message}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {formatShortDate(notification.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel className="mt-6" title="Live Classes" subtitle="Join any session that is open for your enrolled courses.">
        <div className="space-y-3">
          {liveClasses.length ? (
            liveClasses.map((liveClass: any) => (
              <div key={liveClass.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{liveClass.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{liveClass.courseTitle}</p>
                  </div>
                  <Badge tone={liveClass.status === "LIVE" ? "green" : "purple"}>{liveClass.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{formatShortDate(liveClass.startsAt)}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/live-classes/${liveClass.id}`}
                    className="rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-4 py-3 text-sm font-semibold text-white"
                  >
                    {liveClass.status === "LIVE" ? "Join now" : "View live class"}
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="No live classes yet" description="Your instructors will schedule live sessions here when they are ready." />
          )}
        </div>
      </Panel>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming Assignments">
          <div className="space-y-3">
            {assignments.slice(0, 6).map((assignment: any) => (
              <div key={assignment.id} className="rounded-[22px] bg-[#fff8f8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{assignment.title}</p>
                  <Badge tone={assignment.submissions.length ? "green" : "red"}>
                    {assignment.submissions.length ? "Submitted" : "Pending"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{assignment.course.title}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#b42323]">
                  Due {formatShortDate(assignment.dueAt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Quiz Attempts">
          <div className="space-y-3">
            {quizAttempts.slice(0, 6).map((attempt: any) => (
              <div key={attempt.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                <p className="font-semibold text-slate-950">{attempt.quiz.title}</p>
                <p className="mt-1 text-sm text-slate-600">{attempt.quiz.course.title}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Attempt {attempt.attemptNumber} • {typeof attempt.score === "number" ? `${formatQuizScore(attempt.score)} of ${formatQuizScore(attempt.quiz.quizQuestions.reduce((total: number, question: any) => total + Number(question.marksOverride ?? question.questionBank.marks ?? 0), 0))} points` : "Awaiting score"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardLayout>
  );
}








