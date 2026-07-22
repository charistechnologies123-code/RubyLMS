import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useState } from "react";
import ApiActionButton from "@/components/ui/ApiActionButton";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Panel from "@/components/ui/Panel";
import WeekdayCheckboxGroup from "@/components/ui/WeekdayCheckboxGroup";
import { getVisibleCourseWhere } from "@/lib/lms";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const courses = await prisma.course.findMany({
      where: getVisibleCourseWhere(session),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        status: true,
        createdAt: true,
        attendanceDays: true,
        instructor: {
          select: { id: true, fullName: true },
        },
        courseManagers: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        lessons: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            order: true,
            pages: {
              select: {
                id: true,
              },
            },
          },
          take: 3,
        },
        _count: {
          select: {
            lessons: true,
            resources: true,
            assignments: true,
            quizzes: true,
            announcements: true,
            questions: true,
            enrollments: true,
          },
        },
      },
    });

    const instructors =
      session.role === "ADMIN"
        ? await prisma.user.findMany({
            where: { role: { in: ["ADMIN", "INSTRUCTOR"] }, status: "ACTIVE", archivedAt: null },
            select: { id: true, fullName: true, role: true },
            orderBy: { fullName: "asc" },
          })
        : [];

    const students =
      session.role !== "STUDENT"
        ? await prisma.user.findMany({
            where: { role: "STUDENT", status: "ACTIVE", archivedAt: null },
            select: { id: true, fullName: true, studentId: true },
            orderBy: { fullName: "asc" },
          })
        : [];

    return {
      courses: serialize(courses),
      instructors: serialize(instructors),
      students: serialize(students),
    };
  });
}

export default function CoursesDirectoryPage({
  session,
  courses,
  instructors,
  students,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const canManage = session.role !== "STUDENT";
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Courses"
      description="Browse courses from a clean card directory, then expand the one you want to manage."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {canManage ? (
          <Panel
            title="Create Course"
            subtitle="Keep the homepage card-based and open this builder only when you need a new course."
            className="overflow-hidden"
          >
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowCreateCourse((current) => !current)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  showCreateCourse
                    ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                    : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                }`}
              >
                {showCreateCourse ? "Close Course Builder" : "Create Course"}
              </button>

              {showCreateCourse ? (
                <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                  <ApiForm
                    action="/api/courses"
                    submitLabel="Create course"
                    successMessage="Course created successfully."
                    className="grid gap-4 md:grid-cols-2"
                    onSuccess={() => setShowCreateCourse(false)}
                  >
                    <FormField label="Course title" name="title" placeholder="Introduction to Data Literacy" required />
                    <FormField
                      label="Course status"
                      name="status"
                      as="select"
                      defaultValue="DRAFT"
                      options={[
                        { label: "Draft", value: "DRAFT" },
                        { label: "Published", value: "PUBLISHED" },
                      ]}
                    />
                      <WeekdayCheckboxGroup name="attendanceDays" />
                      {session.role === "ADMIN" && (
                        <>
                          <FormField
                            label="Primary instructor"
                            name="instructorId"
                            as="select"
                            defaultValue=""
                            options={[
                              { label: "No instructor yet", value: "" },
                              ...instructors.map((instructor) => ({
                                label: `${instructor.fullName} (${instructor.role})`,
                                value: instructor.id,
                              })),
                            ]}
                          />
                          <label className="block md:col-span-2">
                            <span className="text-sm font-semibold text-slate-700">Additional instructors/admins</span>
                            <div className="mt-2 grid gap-2 rounded-[20px] border border-[#e8ddff] bg-white p-4">
                              {instructors.length ? instructors.map((instructor) => (
                                <label key={instructor.id} className="flex items-center gap-3 text-sm text-slate-700">
                                  <input type="checkbox" name="managerIds" value={instructor.id} />
                                  <span>{instructor.fullName} ({instructor.role})</span>
                                </label>
                              )) : (
                                <p className="text-sm text-slate-600">No active staff available.</p>
                              )}
                            </div>
                          </label>
                        </>
                      )}
                    <div className="md:col-span-2">
                      <ImageUploadField
                        label="Course thumbnail"
                        name="thumbnailUrl"
                        helperText="Upload a course cover image up to 750KB."
                        emptyLabel="No cover"
                        maxFileSizeKb={750}
                        previewClassName="h-24 w-40 rounded-[20px]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FormField
                        label="Description"
                        name="description"
                        as="textarea"
                        placeholder="Add the course overview, outcomes, and expectations."
                        required
                      />
                    </div>
                  </ApiForm>
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  New courses open from this card so the rest of the homepage can stay focused on the course list.
                </p>
              )}
            </div>
          </Panel>
        ) : null}

        {!courses.length ? (
          <div className={canManage ? "" : "xl:col-span-2"}>
            <EmptyState
              title="No courses available yet"
              description={
                canManage
                  ? "You can create the first course from the builder panel."
                  : "Once you are enrolled in a published course, it will appear here."
              }
            />
          </div>
        ) : (
          <>
          {courses.map((course) => (
            <Panel key={course.id} title={course.title} subtitle={course.description} className="overflow-hidden">
              {course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnailUrl} alt={`${course.title} thumbnail`} className="mb-5 h-48 w-full rounded-[24px] object-cover" />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={course.status === "PUBLISHED" ? "green" : course.status === "ARCHIVED" ? "red" : "purple"}>{course.status}</Badge>
                <Badge tone="slate">{course._count.lessons} modules</Badge>
                <Badge tone="slate">{course._count.resources} resources</Badge>
                <Badge tone="slate">{course._count.assignments} assignments</Badge>
                <Badge tone="slate">{course._count.quizzes} quizzes</Badge>
                <Badge tone="slate">{course._count.announcements} announcements</Badge>
                <Badge tone="slate">{course._count.questions} Q&A threads</Badge>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-4">
                  <div className="rounded-[22px] bg-[#faf7ff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Instructor</p>
                    <p className="mt-2 font-semibold text-slate-950">{course.instructor?.fullName ?? "Unassigned"}</p>
                    {course.courseManagers.length ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Also managed by {course.courseManagers.map((manager) => manager.user.fullName).join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-600">{course._count.enrollments} learner(s) enrolled</p>
                  </div>

                  <div>
                    <p className="font-heading text-lg text-slate-950">Module Trail</p>
                    <div className="mt-3 space-y-2">
                      {course.lessons.length ? (
                        course.lessons.map((lesson) => (
                          <div key={lesson.id} className="rounded-[18px] border border-[#efe6ff] bg-white px-4 py-3 text-sm text-slate-700">
                            {lesson.title} ({lesson.pages.length} page{lesson.pages.length === 1 ? "" : "s"})
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600">No lessons added yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/courses/${course.id}`}
                    className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
                  >
                    Open course
                  </Link>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCourseId((currentCourseId) =>
                          currentCourseId === course.id ? null : course.id,
                        )
                      }
                      className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-[#6b00ff]"
                    >
                      {expandedCourseId === course.id ? "Close Management" : "Manage Course"}
                    </button>
                  ) : null}
                </div>

                {canManage && expandedCourseId === course.id ? (
                  <div className="grid gap-6 rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div className="min-w-0 space-y-4">
                        <p className="font-heading text-lg text-slate-950">Edit Course</p>
                        <ApiForm
                          action={`/api/courses/${course.id}`}
                          method="PATCH"
                          submitLabel="Save course"
                          successMessage="Course updated."
                          resetOnSuccess={false}
                          className="grid gap-4"
                        >
                          <FormField label="Course title" name="title" defaultValue={course.title} required />
                          <FormField
                            label="Status"
                            name="status"
                            as="select"
                            defaultValue={course.status}
                            options={[
                              { label: "Draft", value: "DRAFT" },
                              { label: "Published", value: "PUBLISHED" },
                              { label: "Archived", value: "ARCHIVED" },
                            ]}
                          />
                          <WeekdayCheckboxGroup name="attendanceDays" defaultValues={course.attendanceDays} />
                          {session.role === "ADMIN" ? (
                            <>
                              <FormField
                                label="Primary instructor"
                                name="instructorId"
                                as="select"
                                defaultValue={course.instructor?.id ?? ""}
                                options={[
                                  { label: "No instructor yet", value: "" },
                                  ...instructors.map((instructor) => ({
                                    label: `${instructor.fullName} (${instructor.role})`,
                                    value: instructor.id,
                                  })),
                                ]}
                              />
                              <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Additional instructors/admins</span>
                                <div className="mt-2 grid gap-2 rounded-[20px] border border-[#e8ddff] bg-white p-4">
                                  {instructors.length ? (
                                    instructors.map((instructor) => (
                                    <label key={instructor.id} className="flex items-center gap-3 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        name="managerIds"
                                        value={instructor.id}
                                        defaultChecked={course.courseManagers.some((manager) => manager.user.id === instructor.id)}
                                      />
                                      <span>{instructor.fullName} ({instructor.role})</span>
                                    </label>
                                    ))
                                  ) : (
                                    <p className="text-sm text-slate-600">No active staff available.</p>
                                  )}
                                </div>
                              </label>
                            </>
                          ) : null}
                          <ImageUploadField
                            label="Course thumbnail"
                            name="thumbnailUrl"
                            defaultValue={course.thumbnailUrl ?? ""}
                            helperText="Upload a course cover image up to 750KB."
                            emptyLabel="No cover"
                            maxFileSizeKb={750}
                            previewClassName="h-24 w-40 rounded-[20px]"
                          />
                          <FormField label="Description" name="description" as="textarea" defaultValue={course.description} required />
                        </ApiForm>
                        <div className="flex flex-wrap gap-3">
                          {session.role === "ADMIN" ? (
                            <ApiActionButton
                              action={`/api/courses/${course.id}`}
                              method="PATCH"
                              payload={{ status: "ARCHIVED" }}
                              successMessage="Course archived."
                              label="Archive course"
                              pendingLabel="Archiving..."
                              tone="default"
                            />
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-600">
                          Permanent deletion is only available from Admin Archives after a course has been archived.
                        </p>
                      </div>

                      <div className="min-w-0 space-y-4">
                        <p className="font-heading text-lg text-slate-950">Enroll Students</p>
                        <ApiForm
                          action="/api/enrollments"
                          submitLabel="Enroll learner"
                          successMessage="Learner enrolled."
                          className="grid gap-4"
                        >
                          <input type="hidden" name="courseId" value={course.id} />
                          <FormField
                            label="Student"
                            name="studentId"
                            as="select"
                            options={students.map((student) => ({
                              label: `${student.fullName}${student.studentId ? ` (${student.studentId})` : ""}`,
                              value: student.id,
                            }))}
                            required
                            disabled={!students.length}
                          />
                        </ApiForm>
                        {!students.length ? (
                          <p className="text-sm text-slate-600">No active students available to enroll.</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                      <div>
                        <p className="font-heading text-lg text-slate-950">Modules</p>
                        <div className="mt-3 space-y-3">
                          {course.lessons.length ? (
                            course.lessons.map((lesson) => (
                              <div key={lesson.id} className="rounded-[20px] border border-[#efe6ff] bg-white p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="font-semibold text-slate-950">{lesson.title}</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {lesson.pages.length} page{lesson.pages.length === 1 ? "" : "s"}
                                    </p>
                                  </div>
                                  <Link
                                    href={`/courses/${course.id}/lessons/${lesson.id}`}
                                    className="inline-flex rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                                  >
                                    Edit module
                                  </Link>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-600">No modules added yet.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="font-heading text-lg text-slate-950">Add Module</p>
                        <ApiForm
                          action="/api/lessons"
                          submitLabel="Add module"
                          successMessage="Module added."
                          className="mt-3 grid gap-4"
                        >
                          <input type="hidden" name="courseId" value={course.id} />
                          <FormField label="Module title" name="title" required />
                          <FormField
                            label="Status"
                            name="status"
                            as="select"
                            defaultValue="PUBLISHED"
                            options={[
                              { label: "Published", value: "PUBLISHED" },
                              { label: "Draft", value: "DRAFT" },
                            ]}
                          />
                          <FormField
                            label="Module overview"
                            name="content"
                            as="textarea"
                            rows={6}
                            placeholder="Short module overview for the course home card."
                            required
                          />
                        </ApiForm>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>
          ))}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
