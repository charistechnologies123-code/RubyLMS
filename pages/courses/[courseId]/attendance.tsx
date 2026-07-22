import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { getDefaultRouteForRole, getSessionFromPageContext, assertRoleAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

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

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(session.role === "ADMIN"
        ? {}
        : session.role === "INSTRUCTOR"
          ? getManagedCourseWhere(session)
          : {
              status: "PUBLISHED",
              enrollments: {
                some: {
                  studentId: session.userId,
                },
              },
            }),
    },
    include: {
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              studentId: true,
            },
          },
        },
      },
      attendanceSessions: {
        orderBy: { sessionDate: "desc" },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          records: {
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  studentId: true,
                },
              },
              recordedBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
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

  return {
    props: {
      session,
      course: serialize(course),
    },
  };
}

export default function CourseAttendancePage({ session, course }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const canManage = session.role !== "STUDENT";
  const myStudentId = session.role === "STUDENT" ? session.userId : null;

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${course.title} - Attendance`}
      description="Track course attendance by session and sync the marks into the gradebook."
    >
      <div className="space-y-6">
        <Panel title="Attendance Overview" subtitle="Course meeting days and attendance sessions live here.">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="slate">{course.enrollments.length} learners</Badge>
            {course.attendanceDays.length ? course.attendanceDays.map((day: string) => <Badge key={day} tone="purple">{day}</Badge>) : <Badge tone="slate">No scheduled weekdays set</Badge>}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel title="Attendance Sessions" subtitle="Clock students in and out for each class meeting.">
            <div className="space-y-4">
              {course.attendanceSessions.length ? (
                course.attendanceSessions.map((attendanceSession: any) => {
                  const recordsByStudentId = new Map<string, any>(attendanceSession.records.map((record: any) => [record.student.id, record]));

                  return (
                    <article key={attendanceSession.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{attendanceSession.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{formatDate(attendanceSession.sessionDate)}</p>
                        </div>
                        <Badge tone="slate">{attendanceSession.records.length} records</Badge>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                        Created by {attendanceSession.createdBy.fullName}
                      </p>

                      <div className="mt-4 space-y-3">
                        {canManage
                          ? course.enrollments.map((enrollment: any) => {
                              const record = (recordsByStudentId.get(enrollment.student.id) as any) ?? null;

                              return (
                                <div key={enrollment.student.id} className="rounded-[20px] border border-[#efe6ff] bg-[#faf7ff] p-4">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                      <p className="font-semibold text-slate-950">{enrollment.student.fullName}</p>
                                      <p className="mt-1 text-sm text-slate-600">{enrollment.student.studentId ?? "No student ID"}</p>
                                      {record ? (
                                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                                          In: {record.clockInAt ? formatDate(record.clockInAt) : "�"} | Out: {record.clockOutAt ? formatDate(record.clockOutAt) : "�"}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <ApiActionButton
                                        action={`/api/courses/${course.id}/attendance-sessions/${attendanceSession.id}/records`}
                                        method="POST"
                                        payload={{ studentId: enrollment.student.id, action: "clockIn" }}
                                        successMessage="Student clocked in."
                                        label="Clock in"
                                        pendingLabel="Saving..."
                                        tone="success"
                                      />
                                      <ApiActionButton
                                        action={`/api/courses/${course.id}/attendance-sessions/${attendanceSession.id}/records`}
                                        method="POST"
                                        payload={{ studentId: enrollment.student.id, action: "clockOut" }}
                                        successMessage="Student clocked out."
                                        label="Clock out"
                                        pendingLabel="Saving..."
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          : (() => {
                              const record = myStudentId ? (recordsByStudentId.get(myStudentId) as any) ?? null : null;
                              return (
                                <div className="rounded-[20px] border border-[#efe6ff] bg-[#faf7ff] p-4">
                                  <p className="font-semibold text-slate-950">Your attendance status</p>
                                  {record ? (
                                    <p className="mt-2 text-sm text-slate-700">
                                      Clock in: {record.clockInAt ? formatDate(record.clockInAt) : "Not yet recorded"}
                                      <br />
                                      Clock out: {record.clockOutAt ? formatDate(record.clockOutAt) : "Not yet recorded"}
                                    </p>
                                  ) : (
                                    <p className="mt-2 text-sm text-slate-600">No attendance record has been logged for you yet.</p>
                                  )}
                                </div>
                              );
                            })()}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState title="No attendance sessions yet" description={canManage ? "Create the first attendance session using the form on the right." : "Your attendance sessions will appear here when they are added."} />
              )}
            </div>
          </Panel>

          {canManage ? (
            <Panel title="Create Attendance Session" subtitle="Pick a date that matches the course's meeting weekdays.">
              <ApiForm action={`/api/courses/${course.id}/attendance-sessions`} submitLabel="Create session" successMessage="Attendance session created." className="grid gap-4">
                <FormField label="Session title" name="title" required placeholder="Week 1 attendance" />
                <FormField label="Session date" name="sessionDate" type="date" required />
                <FormField label="Start time" name="startsAt" type="datetime-local" />
                <FormField label="End time" name="endsAt" type="datetime-local" />
              </ApiForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
