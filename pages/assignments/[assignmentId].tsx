import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FileDisplay from "@/components/ui/FileDisplay";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { formatDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR"], async (session) => {
    const assignmentId = String(ctx.params?.assignmentId ?? "");

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          include: {
            courseManagers: true,
          },
        },
        submissions: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                studentId: true,
              },
            },
          },
          orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
        },
      },
    });

    if (!assignment) {
      return {
        redirect: {
          destination: "/assignments",
          permanent: false,
        },
      };
    }

    if (
      !canManageCourse(
        session,
        [assignment.course.instructorId, assignment.course.createdById, ...assignment.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[],
      )
    ) {
      return {
        redirect: {
          destination: "/assignments",
          permanent: false,
        },
      };
    }

    return {
      assignment: serialize(assignment),
    };
  });
}

export default function AssignmentSubmissionsPage({
  session,
  assignment,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [showSubmissions, setShowSubmissions] = useState(false);

  if (!assignment) {
    return null;
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${assignment.title} Submissions`}
      description="Open the submissions view when you’re ready to review work, grade, and leave feedback."
    >
      <div className="space-y-6">
        <Panel title={assignment.title} subtitle={assignment.course.title}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="purple">{assignment.course.title}</Badge>
            <Badge tone="slate">{assignment.submissionType}</Badge>
            <Badge tone={assignment.status === "PUBLISHED" ? "green" : "purple"}>{assignment.status}</Badge>
            <Badge tone="red">Due {assignment.dueAt ? formatDate(assignment.dueAt) : "No due date"}</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/assignments"
              className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Back to assignments
              </Link>
            <button
              type="button"
              onClick={() => setShowSubmissions((current) => !current)}
              className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white"
            >
              {showSubmissions ? "Hide submissions" : "View submissions"}
            </button>
          </div>
        </Panel>

        <Panel title="Submissions" subtitle="The review and grading tools appear after you open this section.">
          {!showSubmissions ? (
            <EmptyState
              title="Submissions hidden"
              description="Click View submissions to open student work, grading, and feedback."
            />
          ) : !assignment.submissions.length ? (
            <EmptyState title="No submissions yet" description="Student submissions will appear here after they respond." />
          ) : (
            <div className="space-y-3">
              {assignment.submissions.map((submission) => (
                <div key={submission.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="font-semibold text-slate-950">{submission.student.fullName}</p>
                      <p className="text-sm text-slate-600">{submission.student.studentId ?? "No ID"}</p>
                      <p className="mt-1 text-sm text-slate-600">Submitted {formatDate(submission.submittedAt)}</p>
                      {submission.gradedAt ? <p className="mt-1 text-sm text-slate-600">Graded {formatDate(submission.gradedAt)}</p> : null}
                      {submission.textSubmission ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{submission.textSubmission}</p> : null}
                      {submission.linkUrl ? (
                        <a
                          href={submission.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-sm font-semibold text-[#6b00ff]"
                        >
                          Open submitted link
                        </a>
                      ) : null}
                      {submission.fileUrl ? (
                        <div className="mt-3">
                          <FileDisplay url={submission.fileUrl} title="Submission file" />
                        </div>
                      ) : null}
                      {!submission.textSubmission && !submission.linkUrl && !submission.fileUrl ? (
                        <p className="mt-3 text-sm text-slate-600">Submission recorded without extra attachment or text.</p>
                      ) : null}
                    </div>

                    <div className="min-w-[280px]">
                      <ApiForm
                        action="/api/assignments/grade"
                        submitLabel="Save grade"
                        successMessage="Grade saved."
                        className="grid gap-3"
                        resetOnSuccess={false}
                      >
                        <input type="hidden" name="submissionId" value={submission.id} />
                        <FormField label="Score" name="score" type="number" defaultValue={submission.score ?? ""} />
                        <FormField label="Feedback" name="feedback" as="textarea" defaultValue={submission.feedback ?? ""} />
                      </ApiForm>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}
