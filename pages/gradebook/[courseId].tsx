import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GradebookSpreadsheet from "@/components/gradebook/GradebookSpreadsheet";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FileUploadField from "@/components/ui/FileUploadField";
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

    await syncCourseGradebook(courseId);

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        ...(session.role === "ADMIN" ? {} : getManagedCourseWhere(session)),
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
          orderBy: {
            student: {
              fullName: "asc",
            },
          },
        },
        gradebookColumns: {
          include: {
            cells: true,
          },
          orderBy: { order: "asc" },
        },
        gradebookPublication: true,
      },
    });

    if (!course) {
      return {
        redirect: {
          destination: "/gradebook",
          permanent: false,
        },
      };
    }

    return {
      course: serialize(course),
    };
  });
}

export default function CourseGradebookPage({
  session,
  course,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  if (!course) {
    return null;
  }

  const students = course.enrollments.map((enrollment) => enrollment.student);
  const columns = course.gradebookColumns.map((column) => ({
    id: column.id,
    title: column.title,
    type: column.type,
    maxScore: column.maxScore,
    includeInTotals: column.includeInTotals,
    scorePath: `/gradebook/${course.id}/columns/${column.id}`,
    editable: true,
    cells: column.cells.map((cell) => ({
      studentId: cell.studentId,
      score: cell.score,
    })),
  }));

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`${course.title} Gradebook`}
      description="Build this course gradebook column by column, import quiz or assignment scores when you choose, and publish the finished sheet to students."
    >
      <div className="space-y-6">
        <Panel title={course.title} subtitle="Course gradebook">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="purple">{students.length} students</Badge>
            <Badge tone="slate">{course.gradebookColumns.length} columns</Badge>
            <ApiActionButton
              action="/api/gradebook/publish"
              method="PATCH"
              payload={{ courseId: course.id, published: !course.gradebookPublication?.publishedAt }}
              successMessage={course.gradebookPublication?.publishedAt ? "Gradebook unpublished." : "Gradebook published."}
              label={course.gradebookPublication?.publishedAt ? "Unpublish gradebook" : "Publish gradebook"}
              pendingLabel="Saving..."
              tone={course.gradebookPublication?.publishedAt ? "default" : "success"}
            />
            <Link
              href="/gradebook"
              className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Back to all gradebooks
            </Link>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel title="Add Columns" subtitle="Create columns manually for quizzes, assignments, attendance, tests, projects, CA, or any other score item.">
            <ApiForm
              action={`/api/gradebook/courses/${course.id}/columns`}
              submitLabel="Add gradebook column"
              successMessage="Gradebook column created."
              className="grid gap-4"
            >
              <FormField label="Column title" name="title" required placeholder="Participation" />
              <FormField
                label="Column type"
                name="type"
                as="select"
                defaultValue="CUSTOM"
                options={[
                  { label: "Custom", value: "CUSTOM" },
                  { label: "Attendance", value: "ATTENDANCE" },
                ]}
              />
              <FormField label="Maximum score" name="maxScore" type="number" placeholder="100" />
            </ApiForm>
          </Panel>

          <Panel title="Import CSV" subtitle="Keep manual importing, either as rows or as a spreadsheet-style table.">
            <ApiForm
              action="/api/gradebook/import"
              submitLabel="Import gradebook CSV"
              successMessage="Gradebook updated."
              className="grid gap-4"
            >
              <input type="hidden" name="courseId" value={course.id} />
              <FileUploadField
                label="CSV upload"
                name="csvFile"
                helperText="Accepted formats: studentId,title,score,maxScore or studentId,column1,column2,..."
                accept=".csv,text/csv"
              />
              <FormField
                label="Or paste CSV"
                name="csvText"
                as="textarea"
                rows={6}
                placeholder={"studentId,title,score,maxScore\nRBY-STD-0001,Midterm,45,50\n\nor\n\nstudentId,Attendance,Participation\nRBY-STD-0001,90,15"}
              />
            </ApiForm>
          </Panel>
        </div>

        {!students.length ? (
          <EmptyState title="No enrolled students" description="Enroll students in this course to start using the gradebook." />
        ) : (
          <Panel
            title="Course Grade Sheet"
            subtitle="Every column is editable here like a worksheet. Open a column when you want to import quiz or assignment scores, review students, or clear a student score."
          >
            <GradebookSpreadsheet courseId={course.id} students={students} columns={columns} />
          </Panel>
        )}
      </div>
    </DashboardLayout>
  );
}
