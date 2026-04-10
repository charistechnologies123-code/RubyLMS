import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { formatDate } from "@/lib/format";
import { syncCourseGradebook } from "@/lib/gradebook";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR"], async (session) => {
    const courseId = String(ctx.params?.courseId ?? "");
    const columnId = String(ctx.params?.columnId ?? "");

    await syncCourseGradebook(courseId);

    const column = await prisma.gradebookColumn.findFirst({
      where: {
        id: columnId,
        courseId,
        course: session.role === "ADMIN" ? undefined : getManagedCourseWhere(session),
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        cells: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                studentId: true,
              },
            },
            selectedQuizAttempt: true,
            selectedAssignmentSubmission: true,
          },
          orderBy: {
            student: {
              fullName: "asc",
            },
          },
        },
      },
    });

    if (!column) {
      return {
        redirect: {
          destination: `/gradebook/${courseId}`,
          permanent: false,
        },
      };
    }

    const attempts =
      column.type === "QUIZ" && column.sourceId
        ? await prisma.quizAttempt.findMany({
            where: {
              quizId: column.sourceId,
              isSubmitted: true,
            },
            orderBy: [{ student: { fullName: "asc" } }, { attemptNumber: "asc" }],
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  studentId: true,
                },
              },
            },
          })
        : [];

    return {
      column: serialize(column),
      attempts: serialize(attempts),
    };
  });
}

export default function GradebookColumnPage({
  session,
  column,
  attempts,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  if (!column) {
    return null;
  }

  const attemptsByStudent = new Map<string, typeof attempts>();

  for (const attempt of attempts) {
    const currentAttempts = attemptsByStudent.get(attempt.studentId) ?? [];
    currentAttempts.push(attempt);
    attemptsByStudent.set(attempt.studentId, currentAttempts);
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${column.title} Scores`}
      description={`Gradebook column in ${column.course.title}.`}
    >
      <div className="space-y-6">
        <Panel title={column.title} subtitle={column.course.title}>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge tone="purple">{column.type}</Badge>
            <Badge tone="slate">{column.cells.length} students</Badge>
            <Badge tone="green">
              {typeof column.maxScore === "number" ? `Max ${column.maxScore}` : "No max score set"}
            </Badge>
          </div>

          <ApiForm
            action={`/api/gradebook/columns/${column.id}`}
            method="PATCH"
            submitLabel="Save column settings"
            successMessage="Gradebook column updated."
            className="grid gap-4 lg:grid-cols-3"
            resetOnSuccess={false}
          >
            <FormField
              label="Column title"
              name="title"
              defaultValue={column.title}
              required
              disabled={column.type === "QUIZ" || column.type === "ASSIGNMENT"}
            />
            <FormField label="Maximum score" name="maxScore" type="number" defaultValue={column.maxScore ?? ""} />
            <FormField
              label="Include in totals"
              name="includeInTotals"
              as="select"
              defaultValue={column.includeInTotals ? "true" : "false"}
              options={[
                { label: "Yes", value: "true" },
                { label: "No", value: "false" },
              ]}
            />
          </ApiForm>

          <div className="mt-4 flex flex-wrap gap-3">
            {(column.type === "CUSTOM" || column.type === "ATTENDANCE") ? (
              <ApiActionButton
                action={`/api/gradebook/columns/${column.id}`}
                method="DELETE"
                successMessage="Gradebook column deleted."
                label="Delete column"
                pendingLabel="Deleting..."
                tone="danger"
                confirmMessage={`Delete ${column.title}? This will remove scores in this column.`}
              />
            ) : null}

            <Link
              href={`/gradebook/${column.course.id}`}
              className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Back to course gradebook
            </Link>
          </div>
        </Panel>

        <Panel
          title={`${column.title} Breakdown`}
          subtitle={
            column.type === "QUIZ"
              ? "Choose the attempt that should count for each student."
              : column.type === "ASSIGNMENT"
                ? "Review the recorded assignment scores for enrolled students."
                : "Review scores stored in this column."
          }
        >
          {!column.cells.length ? (
            <EmptyState title="No students in this course yet" description="Enroll students to start recording scores." />
          ) : (
            <div className="space-y-3">
              {column.cells.map((cell) => {
                const studentAttempts = attemptsByStudent.get(cell.studentId) ?? [];

                return (
                  <div key={cell.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">{cell.student.fullName}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          {cell.student.studentId ?? "No student ID"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">
                          Current score {typeof cell.score === "number" ? cell.score : "Not graded"}
                        </Badge>
                        {typeof column.maxScore === "number" ? <Badge tone="green">/ {column.maxScore}</Badge> : null}
                      </div>
                    </div>

                    {column.type === "QUIZ" ? (
                      <div className="mt-4">
                        {studentAttempts.length ? (
                          <ApiForm
                            action={`/api/gradebook/columns/${column.id}/attempts`}
                            method="PATCH"
                            submitLabel="Save selected attempt"
                            successMessage="Selected quiz attempt updated."
                            className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
                            resetOnSuccess={false}
                          >
                            <input type="hidden" name="studentId" value={cell.studentId} />
                            <FormField
                              label="Attempt to use"
                              name="attemptId"
                              as="select"
                              defaultValue={cell.selectedQuizAttemptId ?? studentAttempts[0]?.id ?? ""}
                              options={studentAttempts.map((attempt) => ({
                                label: `Attempt ${attempt.attemptNumber} | Score ${attempt.score ?? 0} | Submitted ${formatDate(attempt.submittedAt ?? attempt.updatedAt)}`,
                                value: attempt.id,
                              }))}
                            />
                          </ApiForm>
                        ) : (
                          <p className="mt-3 text-sm text-slate-600">No submitted attempts for this student yet.</p>
                        )}
                      </div>
                    ) : column.type === "ASSIGNMENT" ? (
                      <p className="mt-3 text-sm text-slate-600">
                        Assignment scores follow the graded submission record. Update the submission score in the assignment workflow if this needs to change.
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">
                        Edit this score from the main course gradebook table.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}
