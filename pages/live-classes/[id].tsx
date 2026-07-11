import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import JitsiMeeting from "@/components/live/JitsiMeeting";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getLiveClassStateLabel, isLiveClassJoinable } from "@/lib/liveClasses";

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

  const liveClassId = typeof ctx.params?.id === "string" ? ctx.params.id : null;

  if (!liveClassId) {
    return {
      redirect: {
        destination: "/courses",
        permanent: false,
      },
    };
  }

  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          role: true,
        },
      },
      course: {
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
        },
      },
    },
  });

  if (!liveClass) {
    return {
      redirect: {
        destination: "/courses",
        permanent: false,
      },
    };
  }

  const managerIds = [liveClass.course.instructorId, liveClass.course.createdById, ...liveClass.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[];
  const canManage = canManageCourse(session, managerIds);
  const isEnrolled = liveClass.course.enrollments.some((enrollment) => enrollment.studentId === session.userId);
  const canJoin = isEnrolled && isLiveClassJoinable(liveClass);
  const canView = session.role === "ADMIN" || canManage || isEnrolled;

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
      liveClass: serialize(liveClass),
      canManage,
      canJoin,
    },
  };
}

export default function LiveClassPage({ session, liveClass, canManage, canJoin }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const participantNames = [
    liveClass.createdBy.fullName,
    ...liveClass.course.courseManagers.map((manager: any) => manager.user.fullName),
    ...liveClass.course.enrollments.map((enrollment: any) => enrollment.student.fullName),
  ];
  const roomUrl = `https://meet.jit.si/${liveClass.roomName}`;

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={liveClass.title}
      description={liveClass.course.title}
    >
      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={liveClass.status === "LIVE" ? "green" : liveClass.status === "CANCELLED" ? "red" : "purple"}>
                    {getLiveClassStateLabel(liveClass)}
                  </Badge>
                  <Badge tone="slate">{formatDate(liveClass.startsAt)}</Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Hosted by {liveClass.createdBy.fullName} in {liveClass.course.title}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/courses/${liveClass.courseId}/live-classes`}
                  className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                >
                  Back to schedule
                </Link>
                {canManage && liveClass.status === "SCHEDULED" ? (
                  <ApiActionButton
                    action={`/api/live-classes/${liveClass.id}`}
                    method="PATCH"
                    payload={{ status: "LIVE" }}
                    successMessage="Live class started."
                    label="Start now"
                    pendingLabel="Starting..."
                    tone="success"
                  />
                ) : null}
                {canManage && liveClass.status === "LIVE" ? (
                  <ApiActionButton
                    action={`/api/live-classes/${liveClass.id}`}
                    method="PATCH"
                    payload={{ status: "ENDED" }}
                    successMessage="Live class ended."
                    label="End class"
                    pendingLabel="Ending..."
                    tone="default"
                  />
                ) : null}
                {canManage ? (
                  <ApiActionButton
                    action={`/api/live-classes/${liveClass.id}`}
                    method="DELETE"
                    successMessage="Live class cancelled."
                    label="Cancel"
                    pendingLabel="Cancelling..."
                    tone="danger"
                    confirmMessage="Cancel this live class? Students will no longer be able to join it."
                  />
                ) : null}
              </div>
            </div>

            {liveClass.description ? <p className="mt-4 max-w-4xl text-sm text-slate-600">{liveClass.description}</p> : null}

            {canJoin || canManage ? (
              <div className="mt-6">
                <JitsiMeeting
                  roomName={liveClass.roomName}
                  displayName={session.fullName}
                  email={session.email}
                />
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-6">
                <EmptyState
                  title="This session is not ready yet"
                  description="Come back when the class is live or ask your instructor to start it."
                />
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Participants" subtitle="Use the meeting toolbar for the live attendee list, or view the course roster here.">
          <div className="space-y-3">
            {participantNames.length ? (
              participantNames.map((participantName, index) => (
                <div key={`${participantName}-${index}`} className="rounded-[20px] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-slate-900">
                  {participantName}
                </div>
              ))
            ) : (
              <EmptyState title="No participants yet" description="Participants will appear as people join from the dashboard." />
            )}
          </div>
        </Panel>
      </section>
    </DashboardLayout>
  );
}

