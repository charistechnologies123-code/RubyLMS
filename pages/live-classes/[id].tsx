import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { canDeleteLiveClass, getLiveClassStateLabel, isLiveClassJoinable } from "@/lib/liveClasses";

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
  const canDelete = canDeleteLiveClass(session, liveClass);
  const isEnrolled = liveClass.course.enrollments.some((enrollment) => enrollment.studentId === session.userId);
  const meetingUrl = liveClass.meetingUrl ?? "";
  const hasMeetingLink = Boolean(meetingUrl.trim());
  const canJoin = isEnrolled && isLiveClassJoinable(liveClass) && hasMeetingLink;
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
      canDelete,
    },
  };
}

export default function LiveClassPage({ session, liveClass, canManage, canJoin, canDelete }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const participantNames = [
    liveClass.createdBy.fullName,
    ...liveClass.course.courseManagers.map((manager: any) => manager.user.fullName),
    ...liveClass.course.enrollments.map((enrollment: any) => enrollment.student.fullName),
  ];
  const meetingUrl = liveClass.meetingUrl ?? "";
  const hasMeetingLink = Boolean(meetingUrl.trim());

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
                {canDelete ? (
                  <ApiActionButton
                    action={`/api/live-classes/${liveClass.id}`}
                    method="DELETE"
                    successMessage="Live class deleted."
                    label="Delete"
                    pendingLabel="Deleting..."
                    tone="danger"
                    confirmMessage="Delete this live class? Students will no longer be able to access it."
                  />
                ) : null}
              </div>
            </div>

            {liveClass.description ? <p className="mt-4 max-w-4xl text-sm text-slate-600">{liveClass.description}</p> : null}

            {canJoin || canManage ? (
              <div className="mt-6 rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-6">
                {hasMeetingLink ? (
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meeting link</p>
                      <p className="break-all text-sm text-slate-700">{meetingUrl}</p>
                    </div>
                    <a
                      href={meetingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Open live class
                    </a>
                  </div>
                ) : (
                  <EmptyState
                    title="No meeting link provided"
                    description="Ask the instructor or admin to add the live class link in the schedule form."
                  />
                )}
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

        <Panel title="Participants" subtitle="Use the course roster to see who can access this live class.">
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
