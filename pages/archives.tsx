import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import DeleteActionButton from "@/components/ui/DeleteActionButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN"], async () => {
    const [courses, students, instructors, quizzes] = await Promise.all([
      prisma.course.findMany({
        where: { status: "ARCHIVED" },
        include: { instructor: { select: { fullName: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT", archivedAt: { not: null } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({
        where: { role: "INSTRUCTOR", archivedAt: { not: null } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.quiz.findMany({
        where: { archivedAt: { not: null } },
        include: { course: { select: { title: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return {
      courses: serialize(courses),
      students: serialize(students),
      instructors: serialize(instructors),
      quizzes: serialize(quizzes),
    };
  });
}

export default function ArchivesPage({
  session,
  courses,
  students,
  instructors,
  quizzes,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role="ADMIN"
      session={session}
      title="Archives"
      description="Archived records live here until you restore them or remove them permanently."
    >
      <div className="space-y-6">
        <Panel title="Courses Archive">
          {courses.length ? (
            <div className="space-y-3">
              {courses.map((course) => (
                <div key={course.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="red">ARCHIVED</Badge>
                        <Badge tone="slate">{course.instructor?.fullName ?? "Unassigned"}</Badge>
                      </div>
                      <p className="mt-3 font-semibold text-slate-950">{course.title}</p>
                      <p className="mt-2 text-sm text-slate-600">{course.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <ApiActionButton
                        action={`/api/courses/${course.id}`}
                        method="PATCH"
                        payload={{ status: "DRAFT" }}
                        successMessage="Course restored."
                        label="Restore"
                        pendingLabel="Restoring..."
                        tone="success"
                      />
                      <DeleteActionButton
                        action={`/api/courses/${course.id}`}
                        successMessage="Course deleted."
                        confirmMessage={`Delete ${course.title} permanently?`}
                        label="Delete permanently"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No archived courses" description="Archived courses will appear here." />
          )}
        </Panel>

        <Panel title="Students Archive">
          {students.length ? (
            <div className="space-y-3">
              {students.map((user) => (
                <ArchiveUserCard key={user.id} user={user} />
              ))}
            </div>
          ) : (
            <EmptyState title="No archived students" description="Archived students will appear here." />
          )}
        </Panel>

        <Panel title="Instructors Archive">
          {instructors.length ? (
            <div className="space-y-3">
              {instructors.map((user) => (
                <ArchiveUserCard key={user.id} user={user} />
              ))}
            </div>
          ) : (
            <EmptyState title="No archived instructors" description="Archived instructors will appear here." />
          )}
        </Panel>

        <Panel title="Quizzes Archive">
          {quizzes.length ? (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="red">ARCHIVED</Badge>
                        <Badge tone="purple">{quiz.course.title}</Badge>
                      </div>
                      <p className="mt-3 font-semibold text-slate-950">{quiz.title}</p>
                      <p className="mt-2 text-sm text-slate-600">{quiz.description ?? "No description"}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <ApiActionButton
                        action={`/api/quizzes/${quiz.id}`}
                        method="PATCH"
                        payload={{ archived: false }}
                        successMessage="Quiz restored."
                        label="Restore"
                        pendingLabel="Restoring..."
                        tone="success"
                      />
                      <DeleteActionButton
                        action={`/api/quizzes/${quiz.id}`}
                        successMessage="Quiz deleted."
                        confirmMessage={`Delete ${quiz.title} permanently?`}
                        label="Delete permanently"
                      />
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No archived quizzes" description="Archived quizzes will appear here." />
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}

function ArchiveUserCard({
  user,
}: {
  user: {
    id: string;
    fullName: string;
    email: string;
    studentId: string | null;
    role: string;
  };
}) {
  return (
    <div className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="red">ARCHIVED</Badge>
            <Badge tone={user.role === "INSTRUCTOR" ? "green" : "slate"}>{user.role}</Badge>
          </div>
          <p className="mt-3 font-semibold text-slate-950">{user.fullName}</p>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
          {user.role === "STUDENT" ? <p className="mt-1 text-sm text-slate-600">{user.studentId ?? "No student ID"}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <ApiActionButton
            action={`/api/users/${user.id}`}
            method="PATCH"
            payload={{ archived: false }}
            successMessage="User restored."
            label="Restore"
            pendingLabel="Restoring..."
            tone="success"
          />
          <DeleteActionButton
            action={`/api/users/${user.id}`}
            successMessage="User deleted."
            confirmMessage={`Delete ${user.fullName} permanently?`}
            label="Delete permanently"
          />
        </div>
      </div>
    </div>
  );
}
