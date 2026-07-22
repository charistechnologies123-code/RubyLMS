import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { formatDate } from "@/lib/format";
import { getDefaultRouteForRole, getSessionFromPageContext, assertRoleAccess } from "@/lib/auth";
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

  if (!assertRoleAccess(session, ["ADMIN", "STUDENT"])) {
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
            },
          },
        },
      },
      polls: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          options: {
            orderBy: { order: "asc" },
          },
          votes: session.role === "STUDENT" ? { where: { studentId: session.userId } } : true,
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

export default function CoursePollsPage({ session, course }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const canManage = session.role === "ADMIN";
  const [optionRows, setOptionRows] = useState([1, 2]);

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${course.title} - Polls`}
      description="Admins set up course polls here, and students vote on the squads or options they can join."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Polls" subtitle={canManage ? "Create and manage course polls." : "Vote in the polls available to your course."}>
          <div className="space-y-4">
            {course.polls.length ? (
              course.polls.map((poll: any) => {
                const selectedOptionId = poll.votes?.[0]?.optionId ?? null;
                const isOpen = poll.status === "OPEN" && (!poll.closesAt || new Date(poll.closesAt).getTime() > Date.now());

                return (
                  <article key={poll.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{poll.title}</p>
                        {poll.description ? <p className="mt-1 text-sm text-slate-600">{poll.description}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={poll.status === "OPEN" ? "green" : poll.status === "CLOSED" ? "red" : "purple"}>{poll.status}</Badge>
                        {poll.closesAt ? <Badge tone="slate">Closes {formatDate(poll.closesAt)}</Badge> : null}
                      </div>
                    </div>

                    <div className="mt-3 rounded-[20px] bg-[#faf7ff] p-4 text-sm text-slate-700">
                      Created by {poll.createdBy.fullName}
                    </div>

                    <div className="mt-4 space-y-3">
                      {poll.options.map((option: any) => {
                        const selected = selectedOptionId === option.id;
                        const slotsLeft = Math.max(option.slotsTotal - option.slotsTaken, 0);

                        return (
                          <div
                            key={option.id}
                            className={`rounded-[20px] border p-4 ${selected ? "border-[#6b00ff] bg-[#f7f1ff]" : "border-[#efe6ff] bg-white"}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">{option.label}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                                  {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="slate">
                                  {option.slotsTaken}/{option.slotsTotal}
                                </Badge>
                                {selected ? <Badge tone="green">Your choice</Badge> : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {canManage ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <ApiActionButton
                          action={`/api/courses/${course.id}/polls/${poll.id}`}
                          method="PATCH"
                          payload={{ status: poll.status === "OPEN" ? "CLOSED" : "OPEN" }}
                          successMessage={poll.status === "OPEN" ? "Poll closed." : "Poll opened."}
                          label={poll.status === "OPEN" ? "Close poll" : "Open poll"}
                          pendingLabel="Saving..."
                          tone={poll.status === "OPEN" ? "default" : "success"}
                        />
                        <ApiActionButton
                          action={`/api/courses/${course.id}/polls/${poll.id}`}
                          method="DELETE"
                          successMessage="Poll deleted."
                          label="Delete poll"
                          pendingLabel="Deleting..."
                          tone="danger"
                          confirmMessage={`Delete poll \"${poll.title}\"?`}
                        />
                      </div>
                    ) : session.role === "STUDENT" ? (
                      <div className="mt-4">
                        {selectedOptionId ? (
                          <Badge tone="green">You already voted</Badge>
                        ) : isOpen ? (
                          <ApiForm
                            action={`/api/courses/${course.id}/polls/${poll.id}/vote`}
                            submitLabel="Submit vote"
                            successMessage="Vote saved."
                            className="grid gap-3"
                          >
                            <div className="space-y-2">
                              {poll.options.map((option: any) => {
                                const slotsLeft = Math.max(option.slotsTotal - option.slotsTaken, 0);
                                const disabled = slotsLeft <= 0;

                                return (
                                  <label key={option.id} className="flex items-center gap-3 rounded-[18px] border border-[#efe6ff] bg-white px-4 py-3 text-sm text-slate-700">
                                    <input type="radio" name="optionId" value={option.id} required disabled={disabled} />
                                    <span className={disabled ? "text-slate-400" : ""}>{option.label}</span>
                                    <span className="ml-auto text-xs uppercase tracking-[0.16em] text-slate-500">
                                      {slotsLeft} left
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </ApiForm>
                        ) : (
                          <Badge tone="slate">Voting is closed</Badge>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <EmptyState title="No polls yet" description={canManage ? "Create the first poll using the setup form." : "Polls will appear here when your instructor or admin creates them."} />
            )}
          </div>
        </Panel>

        {canManage ? (
          <Panel title="Create Poll" subtitle="Use this for squad selection, check-ins, or one-time course votes.">
            <ApiForm action={`/api/courses/${course.id}/polls`} submitLabel="Create poll" successMessage="Poll created." className="grid gap-4">
              <FormField label="Poll title" name="title" required placeholder="Choose your squad" />
              <FormField label="Description" name="description" as="textarea" rows={4} placeholder="Optional instructions or context." />
              <FormField
                label="Status"
                name="status"
                as="select"
                defaultValue="OPEN"
                options={[
                  { label: "Open", value: "OPEN" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Closed", value: "CLOSED" },
                ]}
              />
              <FormField label="Closes at" name="closesAt" type="datetime-local" />
              <div className="space-y-3 rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-800">Poll options</p>
                  <button
                    type="button"
                    onClick={() => setOptionRows((current) => [...current, Math.max(...current) + 1])}
                    className="rounded-2xl border border-[#e8ddff] bg-white px-3 py-2 text-sm font-semibold text-[#6b00ff]"
                  >
                    Add option
                  </button>
                </div>
                <div className="space-y-3">
                  {optionRows.map((rowNumber, index) => (
                    <div key={rowNumber} className="grid gap-3 rounded-[20px] border border-[#efe6ff] bg-white p-4 md:grid-cols-[1fr_160px_auto] md:items-end">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Option {index + 1}</span>
                        <input
                          name="optionLabels"
                          required
                          placeholder="Squad A"
                          className="mt-2 w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Slots</span>
                        <input
                          name="slotCounts"
                          type="number"
                          min="1"
                          defaultValue={1}
                          required
                          className="mt-2 w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                        />
                      </label>
                      {optionRows.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => setOptionRows((current) => current.filter((value) => value !== rowNumber))}
                          className="rounded-2xl border border-[#ffd7d7] bg-[#fff5f5] px-3 py-3 text-sm font-semibold text-[#c62828]"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </ApiForm>
          </Panel>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
