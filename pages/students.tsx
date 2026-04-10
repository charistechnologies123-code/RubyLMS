import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR"], async (session) => {
    const [courses, students, enrollments] = await Promise.all([
      prisma.course.findMany({
        where: session.role === "ADMIN" ? {} : getManagedCourseWhere(session),
        select: {
          id: true,
          title: true,
        },
        orderBy: { title: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT", status: "ACTIVE", archivedAt: null },
        select: {
          id: true,
          fullName: true,
          studentId: true,
          email: true,
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.enrollment.findMany({
        where: session.role === "ADMIN" ? {} : { course: getManagedCourseWhere(session) },
        include: {
          course: {
            select: { title: true },
          },
          student: {
            select: { fullName: true, studentId: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      courses: serialize(courses),
      students: serialize(students),
      enrollments: serialize(enrollments),
    };
  });
}

export default function StudentsPage({
  session,
  courses,
  students,
  enrollments,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Enrollments"
      description="Enroll students into active learning spaces and review current course participation."
    >
      <Panel title="Enroll Student" subtitle="Only admins and instructors can place students into courses." className="mb-6">
        <ApiForm
          action="/api/enrollments"
          submitLabel="Enroll student"
          successMessage="Student enrolled."
          className="grid gap-4 md:grid-cols-2"
        >
          <FormField
            label="Course"
            name="courseId"
            as="select"
            options={courses.map((course) => ({ label: course.title, value: course.id }))}
            required
          />
          <FormField
            label="Student"
            name="studentId"
            as="select"
            options={students.map((student) => ({
              label: `${student.fullName} (${student.studentId ?? "No ID"})`,
              value: student.id,
            }))}
            required
          />
        </ApiForm>
      </Panel>

      <Panel title="Current Enrollment Records">
        {!enrollments.length ? (
          <EmptyState title="No enrollments yet" description="Once students are added to courses, they will appear here." />
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <div key={enrollment.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{enrollment.student.fullName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {enrollment.student.email} • {enrollment.student.studentId ?? "No student ID"}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#6b00ff]">
                      Enrolled in {enrollment.course.title}
                    </p>
                  </div>
                  <ApiActionButton
                    action="/api/enrollments"
                    method="DELETE"
                    payload={{ enrollmentId: enrollment.id }}
                    successMessage="Student unenrolled."
                    label="Unenroll"
                    pendingLabel="Removing..."
                    tone="danger"
                    confirmMessage={`Unenroll ${enrollment.student.fullName} from ${enrollment.course.title}?`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}
