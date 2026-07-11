import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { formatShortDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["INSTRUCTOR"], async (session) => {
    const [courses, assignments, questions, announcements] = await Promise.all([
      prisma.course.findMany({
        where: getManagedCourseWhere(session),
        include: {
          enrollments: true,
          lessons: true,
          liveClasses: {
            where: { status: { in: ["SCHEDULED", "LIVE"] } },
            orderBy: { startsAt: "asc" },
            take: 3,
          },
        },
      }),
      prisma.assignment.findMany({
        where: {
          createdById: session.userId,
        },
        include: {
          course: true,
          submissions: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.courseQuestion.findMany({
        where: {
          course: getManagedCourseWhere(session),
        },
        include: {
          course: true,
          askedBy: {
            select: {
              fullName: true,
            },
          },
          answers: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.announcement.findMany({
        where: {
          createdById: session.userId,
        },
        include: { course: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      courses: serialize(courses),
      assignments: serialize(assignments),
      questions: serialize(questions),
      announcements: serialize(announcements),
      stats: {
        courses: courses.length,
        students: courses.reduce((sum, course) => sum + course.enrollments.length, 0),
        submissions: assignments.reduce((sum, assignment) => sum + assignment.submissions.length, 0),
        openQuestions: questions.filter((question) => question.answers.length === 0).length,
      },
    };
  });
}

export default function InstructorDashboard({
  session,
  courses,
  assignments,
  questions,
  announcements,
  stats,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role="INSTRUCTOR"
      session={session}
      title="Instructor Workspace"
      description="Create learning experiences, support students, and keep delivery moving across all assigned courses."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My courses" value={stats.courses} helper="Courses you can manage" />
        <StatCard label="Enrolled students" value={stats.students} helper="Across your current course list" />
        <StatCard label="Submissions" value={stats.submissions} helper="Assignment work received" />
        <StatCard label="Open questions" value={stats.openQuestions} helper="Awaiting replies" accent="red" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Course Delivery" subtitle="Quick look at lessons, live sessions, and enrollment momentum.">
          <div className="space-y-3">
            {courses.map((course: any) => (
              <div key={course.id} className="rounded-[22px] border border-[#eee4ff] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{course.title}</p>
                  <Badge tone={course.status === "PUBLISHED" ? "green" : "purple"}>{course.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{course.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <span>{course.lessons.length} lessons</span>
                  <span>{course.enrollments.length} learners</span>
                </div>
                <div className="mt-4 space-y-2">
                  {course.liveClasses.length ? (
                    course.liveClasses.map((liveClass: any) => (
                      <div key={liveClass.id} className="rounded-[18px] bg-[#faf7ff] p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-950">{liveClass.title}</p>
                          <Badge tone={liveClass.status === "LIVE" ? "green" : "purple"}>{liveClass.status}</Badge>
                        </div>
                        <p className="mt-1 text-slate-600">{formatShortDate(liveClass.startsAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={`/courses/${course.id}/live-classes`}
                            className="rounded-full border border-[#e8ddff] bg-white px-3 py-2 text-xs font-semibold text-[#6b00ff]"
                          >
                            Manage schedule
                          </Link>
                          <Link
                            href={`/live-classes/${liveClass.id}`}
                            className="rounded-full bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-3 py-2 text-xs font-semibold text-white"
                          >
                            Open room
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">No live classes scheduled yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Student Questions" subtitle="Newest questions from your course spaces.">
          <div className="space-y-3">
            {questions.slice(0, 6).map((question: any) => (
              <div key={question.id} className="rounded-[22px] bg-[#faf7ff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{question.title}</p>
                  <Badge tone={question.answers.length ? "green" : "red"}>
                    {question.answers.length ? "Answered" : "Open"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{question.content}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {question.askedBy.fullName} in {question.course.title}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Assignment Pipeline">
          <div className="space-y-3">
            {assignments.slice(0, 6).map((assignment: any) => (
              <div key={assignment.id} className="rounded-[22px] bg-[#fff9fb] p-4">
                <p className="font-semibold text-slate-950">{assignment.title}</p>
                <p className="mt-1 text-sm text-slate-600">{assignment.course.title}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#6b00ff]">
                  {assignment.submissions.length} submissions
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Announcements">
          <div className="space-y-3">
            {announcements.slice(0, 6).map((announcement: any) => (
              <div key={announcement.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                <p className="font-semibold text-slate-950">{announcement.title}</p>
                <p className="mt-1 text-sm text-slate-600">{announcement.course.title}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {formatShortDate(announcement.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DashboardLayout>
  );
}

