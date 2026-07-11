import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getLiveClassStateLabel } from "@/lib/liveClasses";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
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

  const courseId = String(ctx.params?.courseId ?? "");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      instructor: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          role: true,
        },
      },
      courseManagers: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
              studentId: true,
            },
          },
        },
      },
      liveClasses: {
        orderBy: { startsAt: "asc" },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    return {
      redirect: {
        destination: "/courses",
        permanent: false,
      },
    };
  }

  const canManage = canManageCourse(
    session,
    [course.instructorId, course.createdById, ...course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
  );

  const isStudentEnrolled = course.enrollments.some((enrollment) => enrollment.studentId === session.userId);
  const canView = session.role === "ADMIN" || canManage || (session.role === "STUDENT" && isStudentEnrolled && course.status === "PUBLISHED");

  if (!canView) {
    return {
      redirect: {
        destination: getDefaultRouteForRole(session.role),
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
      course: serialize(course),
      canManage,
    },
  };
}

export default function CourseLiveClassesPage({ session, course, canManage }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const now = Date.now();
  const upcomingLiveClasses = course.liveClasses.filter((liveClass: any) => liveClass.status !== "CANCELLED" && liveClass.status !== "ENDED");

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${course.title} • Live Classes`}
      description="Schedule and manage live sessions for this course. Students can join directly from their dashboard when the session is ready."
    >
      <Panel className="mb-6" title="Course Live Classes" subtitle="Use this space to plan your sessions and send students into the room when it is time.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="slate">{course.enrollments.length} enrolled</Badge>
          <Badge tone="slate">{upcomingLiveClasses.length} active/upcoming</Badge>
          <Link href={`/courses/${course.id}`} className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#6b00ff]">
            Back to course
          </Link>
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Scheduled Sessions" subtitle="Students can only join sessions for courses they are enrolled in.">
          <div className="space-y-3">
            {course.liveClasses.length ? (
              course.liveClasses.map((liveClass: any) => {
                const isStarted = new Date(liveClass.startsAt).getTime() <= now;
                const isJoinable = liveClass.status === "LIVE" || (isStarted && liveClass.status !== "CANCELLED" && liveClass.status !== "ENDED");

                return (
                  <article key={liveClass.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{liveClass.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{formatDate(liveClass.startsAt)}</p>
                      </div>
                      <Badge tone={liveClass.status === "LIVE" ? "green" : liveClass.status === "CANCELLED" ? "red" : "purple"}>
                        {getLiveClassStateLabel(liveClass)}
                      </Badge>
                    </div>
                    {liveClass.description ? <p className="mt-3 text-sm text-slate-600">{liveClass.description}</p> : null}
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Hosted by {liveClass.createdBy.fullName}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/live-classes/${liveClass.id}`}
                        className={`inline-flex rounded-2xl px-4 py-3 text-sm font-semibold ${
                          isJoinable
                            ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                            : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                        }`}
                      >
                        {isJoinable ? "Open live room" : "View details"}
                      </Link>
                      {canManage ? (
                        <>
                          <ApiActionButton
                            action={`/api/live-classes/${liveClass.id}`}
                            method="PATCH"
                            payload={{ status: "LIVE" }}
                            successMessage="Live class started."
                            label="Start"
                            pendingLabel="Starting..."
                            disabled={liveClass.status !== "SCHEDULED"}
                            tone="success"
                          />
                          <ApiActionButton
                            action={`/api/live-classes/${liveClass.id}`}
                            method="PATCH"
                            payload={{ status: "ENDED" }}
                            successMessage="Live class ended."
                            label="End"
                            pendingLabel="Ending..."
                            disabled={liveClass.status !== "LIVE"}
                            tone="default"
                          />
                          <ApiActionButton
                            action={`/api/live-classes/${liveClass.id}`}
                            method="DELETE"
                            successMessage="Live class cancelled."
                            label="Cancel"
                            pendingLabel="Cancelling..."
                            tone="danger"
                            confirmMessage="Cancel this live class? Students will no longer be able to join it."
                          />
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState title="No live classes yet" description="Schedule the first session for this course using the form on the right." />
            )}
          </div>
        </Panel>

        <Panel title="Schedule a Live Class" subtitle={canManage ? "Instructors, course managers, and admins can create sessions." : "Only managers can create sessions."}>
          {canManage ? (
            <ApiForm
              action="/api/live-classes"
              submitLabel="Schedule class"
              successMessage="Live class scheduled."
              className="grid gap-4"
            >
              <input type="hidden" name="courseId" value={course.id} />
              <FormField label="Session title" name="title" required placeholder="Week 4 discussion, live lab, office hours..." />
              <FormField label="Description" name="description" as="textarea" rows={5} placeholder="Optional session notes or objectives." />
              <FormField label="Start time" name="startsAt" type="datetime-local" required />
              <FormField label="End time" name="endsAt" type="datetime-local" />
            </ApiForm>
          ) : (
            <EmptyState title="Scheduling locked" description="You can still open any live class that is ready to join." />
          )}
        </Panel>
      </section>

      <Panel className="mt-6" title="Course participants" subtitle="This roster shows who is eligible to join the session. The meeting toolbar also includes the live participants pane.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {course.instructor ? (
            <div className="rounded-[22px] border border-[#efe6ff] bg-[#faf7ff] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Primary instructor</p>
              <p className="mt-2 font-semibold text-slate-950">{course.instructor.fullName}</p>
            </div>
          ) : null}
          {course.courseManagers.map((manager: any) => (
            <div key={manager.userId} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Course manager</p>
              <p className="mt-2 font-semibold text-slate-950">{manager.user.fullName}</p>
            </div>
          ))}
          {course.enrollments.map((enrollment: any) => (
            <div key={enrollment.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Student</p>
              <p className="mt-2 font-semibold text-slate-950">{enrollment.student.fullName}</p>
            </div>
          ))}
        </div>
      </Panel>
    </DashboardLayout>
  );
}

