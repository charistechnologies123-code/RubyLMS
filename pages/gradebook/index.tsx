import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { formatDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR"], async (session) => {
    const courses = await prisma.course.findMany({
      where: session.role === "ADMIN" ? {} : getManagedCourseWhere(session),
      include: {
        enrollments: {
          select: {
            studentId: true,
          },
        },
        gradebookColumns: {
          select: {
            id: true,
            type: true,
          },
        },
        gradebookPublication: true,
      },
      orderBy: { title: "asc" },
    });

    return {
      courses: serialize(courses),
    };
  });
}

export default function GradebookIndexPage({
  session,
  courses,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Gradebook"
      description="Open a course gradebook to build and manage a course-based grade sheet, import CSV data, and publish results to students."
    >
      {!courses.length ? (
        <EmptyState title="No managed courses yet" description="Courses you manage will appear here with their gradebooks." />
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <Panel
              key={course.id}
              title={course.title}
              subtitle={
                course.gradebookPublication?.publishedAt
                  ? `Published ${formatDate(course.gradebookPublication.publishedAt)}`
                  : "Not published yet"
              }
            >
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge tone="purple">{course.enrollments.length} students</Badge>
                <Badge tone="slate">{course.gradebookColumns.length} columns</Badge>
                <Badge tone="green">
                  {course.gradebookColumns.filter((column) => column.type === "ATTENDANCE").length} attendance columns
                </Badge>
              </div>

              <Link
                href={`/gradebook/${course.id}`}
                className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white"
              >
                Open course gradebook
              </Link>
            </Panel>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
