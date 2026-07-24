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
          include: {
            quizzes: {
              where: {
                archivedAt: null,
              },
              orderBy: { title: "asc" },
              select: {
                id: true,
                title: true,
              },
            },
            assignments: {
              orderBy: { title: "asc" },
              select: {
                id: true,
                title: true,
              },
            },
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

    return {
      column: serialize(column),
    };
  });
}

export default function GradebookColumnPage({
  session,
  column,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  if (!column) {
    return null;
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${column.title} Scores`}
      description={`Manage the ${column.title} column in ${column.course.title}.`}
    >
      <div className="space-y-6">
        <Panel title={column.title} subtitle={column.course.title}>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge tone="purple">{column.type}</Badge>
            <Badge tone="slate">{column.cells.length} students</Badge>
            <Badge tone="green">
              {typeof column.maxScore === "number" ? `Obtainable grade ${column.maxScore}` : "No obtainable grade set"}
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
            <FormField label="Column title" name="title" defaultValue={column.title} required />
            <FormField label="Obtainable grade" name="maxScore" type="number" defaultValue={column.maxScore ?? ""} />
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
            <ApiActionButton
              action={`/api/gradebook/columns/${column.id}`}
              method="DELETE"
              successMessage="Gradebook column deleted."
              label="Delete column"
              pendingLabel="Deleting..."
              tone="danger"
              confirmMessage={`Delete ${column.title}? This will remove all scores in this column.`}
              redirectTo={`/gradebook/${column.course.id}`}
            />

            <Link
              href={`/gradebook/${column.course.id}`}
              className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Back to course gradebook
            </Link>
          </div>
        </Panel>

        {column.type === "ATTENDANCE" ? (
          <Panel
            title="Import Course Attendance"
            subtitle="A student is present only when both clock-in and clock-out are recorded. The result is scaled to this column's obtainable grade."
          >
            <ApiForm
              action={`/api/gradebook/columns/${column.id}/import`}
              method="PATCH"
              submitLabel="Import attendance scores"
              successMessage="Attendance scores imported into this column."
            >
              <input type="hidden" name="importType" value="ATTENDANCE" />
            </ApiForm>
          </Panel>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Import From Quiz" subtitle="Choose one quiz in this course and fill this entire column with the best submitted attempt for each student.">
            <ApiForm
              action={`/api/gradebook/columns/${column.id}/import`}
              method="PATCH"
              submitLabel="Import quiz scores"
              successMessage="Quiz scores imported into this column."
              className="grid gap-4"
            >
              <input type="hidden" name="importType" value="QUIZ" />
              <FormField
                label="Quiz"
                name="sourceId"
                as="select"
                options={column.course.quizzes.map((quiz) => ({
                  label: quiz.title,
                  value: quiz.id,
                }))}
                required
              />
            </ApiForm>
          </Panel>

          <Panel title="Import From Assignment" subtitle="Choose one assignment in this course and fill this column with the graded assignment scores for all students.">
            <ApiForm
              action={`/api/gradebook/columns/${column.id}/import`}
              method="PATCH"
              submitLabel="Import assignment scores"
              successMessage="Assignment scores imported into this column."
              className="grid gap-4"
            >
              <input type="hidden" name="importType" value="ASSIGNMENT" />
              <FormField
                label="Assignment"
                name="sourceId"
                as="select"
                options={column.course.assignments.map((assignment) => ({
                  label: assignment.title,
                  value: assignment.id,
                }))}
                required
              />
            </ApiForm>
          </Panel>
        </div>

        <Panel
          title={`${column.title} Breakdown`}
          subtitle="Imported scores can still be edited from the main gradebook. Use this page when you want to import again or clear a particular student score."
        >
          {!column.cells.length ? (
            <EmptyState title="No students in this course yet" description="Enroll students to start recording scores in this column." />
          ) : (
            <div className="space-y-3">
              {column.cells.map((cell) => (
                <div key={cell.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{cell.student.fullName}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {cell.student.studentId ?? "No student ID"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone="slate">
                        Current score {typeof cell.score === "number" ? cell.score : "Not recorded"}
                      </Badge>
                      <ApiActionButton
                        action={`/api/gradebook/columns/${column.id}/students/${cell.studentId}`}
                        method="DELETE"
                        successMessage="Student score cleared from this column."
                        label="Clear student score"
                        pendingLabel="Clearing..."
                        tone="danger"
                        confirmMessage={`Clear ${cell.student.fullName}'s score from ${column.title}?`}
                      />
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
