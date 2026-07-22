/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import ApiActionButton from "@/components/ui/ApiActionButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FileDisplay from "@/components/ui/FileDisplay";
import FileUploadField from "@/components/ui/FileUploadField";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import MarkAnnouncementReadButton from "@/components/ui/MarkAnnouncementReadButton";
import Panel from "@/components/ui/Panel";
import WeekdayCheckboxGroup from "@/components/ui/WeekdayCheckboxGroup";

import { calculateCourseProgress } from "@/lib/courseProgress";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { formatDate, formatShortDate } from "@/lib/format";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type CourseWorkspaceProps = {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  course: any;
  instructors: any[];
};

type CourseComposer =
  | "course"
  | "module"
  | "resource"
  | "announcement"
  | "question"
  | null;

export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<{ session: NonNullable<ReturnType<typeof getSessionFromPageContext>>; course: unknown; instructors: unknown }>> {
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

  const courseId = String(ctx.params?.courseId);

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(session.role === "STUDENT"
        ? {
            status: "PUBLISHED",
            enrollments: { some: { studentId: session.userId } },
          }
        : session.role === "INSTRUCTOR"
          ? {
              ...getManagedCourseWhere(session),
            }
          : {}),
    },
    include: {
      instructor: {
        select: {
          id: true,
          fullName: true,
        },
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
        where: session.role === "STUDENT" ? { status: "PUBLISHED" } : undefined,
        include: {
          pages: {
            orderBy: { order: "asc" },
            include:
              session.role === "STUDENT"
                ? {
                    progress: {
                      where: {
                        studentId: session.userId,
                      },
                      select: {
                        completed: true,
                      },
                    },
                  }
                : undefined,
          },
          resources: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      resources: {
        where: {
          lessonId: null,
        },
        orderBy: { createdAt: "desc" },
      },
      announcements: {
        orderBy: { createdAt: "desc" },
        include: {
          reads: {
            where: {
              userId: session.userId,
            },
            select: {
              id: true,
            },
          },
          createdBy: {
            select: {
              fullName: true,
              role: true,
            },
          },
        },
      },
      questions: {
        orderBy: { createdAt: "desc" },
        include: {
          askedBy: {
            select: {
              fullName: true,
              role: true,
            },
          },
          answers: {
            orderBy: { createdAt: "asc" },
            include: {
              answeredBy: {
                select: {
                  fullName: true,
                  role: true,
                },
              },
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
              email: true,
              studentId: true,
              lessonPageProgress: {
                where: {
                  completed: true,
                  lessonPage: {
                    lesson: {
                      courseId,
                      status: "PUBLISHED",
                    },
                  },
                },
                select: {
                  id: true,
                },
              },
            },
          },
        },
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

  if (!course) {
    return {
      redirect: {
        destination: "/courses",
        permanent: false,
      },
    };
  }

  const instructors =
    session.role === "ADMIN"
      ? await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "INSTRUCTOR"] }, status: "ACTIVE", archivedAt: null },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
        })
      : [];

  return {
    props: {
      session,
      course: serialize(course),
      instructors: serialize(instructors),
    },
  };
}

export default function CourseWorkspacePage({
  session,
  course,
  instructors,
}: CourseWorkspaceProps) {
  const canManage = canManageCourse(
    session,
    [course.instructorId, course.createdById, ...course.courseManagers.map((manager: any) => manager.user.id)].filter(Boolean) as string[],
  );
  const [activeComposer, setActiveComposer] = useState<CourseComposer>(null);
  const [activeReplyQuestionId, setActiveReplyQuestionId] = useState<string | null>(null);
  const totalCoursePages = course.lessons.reduce((total: number, lesson: any) => total + lesson.pages.length, 0);
  const completedCoursePages =
    session.role === "STUDENT"
      ? course.lessons.reduce(
          (total: number, lesson: any) =>
            total + lesson.pages.filter((page: any) => page.progress?.[0]?.completed).length,
          0,
        )
      : 0;
  const courseProgress = calculateCourseProgress(completedCoursePages, totalCoursePages);
  const managedStudentTotalPages = course.lessons
    .filter((lesson: any) => lesson.status === "PUBLISHED")
    .reduce((total: number, lesson: any) => total + lesson.pages.length, 0);

  function toggleComposer(composer: Exclude<CourseComposer, null>) {
    setActiveComposer((currentComposer) => (currentComposer === composer ? null : composer));
  }

  function getComposerButtonClass(composer: Exclude<CourseComposer, null>) {
    return `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
      activeComposer === composer
        ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
        : "border border-[#e8ddff] bg-white text-[#6b00ff]"
    }`;
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={course.title}
      description="This course now lives in its own workspace, with lessons, resources, assessments, announcements, and course-specific discussion all scoped here."
    >
      <Panel className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt={`${course.title} thumbnail`} className="h-56 w-full max-w-3xl rounded-[28px] object-cover" />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={course.status === "PUBLISHED" ? "green" : course.status === "ARCHIVED" ? "red" : "purple"}>{course.status}</Badge>
              <Badge tone="slate">{course._count.enrollments} learners</Badge>
              <Badge tone="slate">{course._count.lessons} lessons</Badge>
              <Badge tone="slate">{course._count.resources} resources</Badge>
              <Badge tone="slate">{course._count.assignments} assignments</Badge>
              <Badge tone="slate">{course._count.quizzes} quizzes</Badge>
            </div>
            <p className="max-w-4xl text-sm text-slate-600 md:text-base">{course.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] bg-[#faf7ff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Instructor</p>
                <p className="mt-2 font-semibold text-slate-950">{course.instructor?.fullName ?? "Unassigned"}</p>
                {course.courseManagers.length ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Also managed by {course.courseManagers.map((manager: any) => manager.user.fullName).join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="rounded-[22px] bg-[#faf7ff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Created</p>
                <p className="mt-2 font-semibold text-slate-950">{formatShortDate(course.createdAt)}</p>
              </div>
              <div className="rounded-[22px] bg-[#faf7ff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Activity</p>
                <p className="mt-2 font-semibold text-slate-950">
                  {course._count.announcements} announcements, {course._count.questions} questions
                </p>
              </div>
            </div>
            {session.role === "STUDENT" ? (
              <div className="rounded-[24px] border border-[#e8ddff] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Course progress</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {courseProgress.percentage}% complete
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {courseProgress.completedPages} of {courseProgress.totalPages} pages marked done
                    </p>
                  </div>
                  <Badge tone={courseProgress.percentage === 100 ? "green" : "purple"}>
                    {courseProgress.percentage === 100 ? "Completed" : "In progress"}
                  </Badge>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f1e8ff]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(135deg,#159957,#38ef7d)] transition-all"
                    style={{ width: `${courseProgress.percentage}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
            {[
              ["Overview", "#overview"],
              ["Modules", "#lessons"],
              ["Live Classes", `/courses/${course.id}/live-classes`],
              ["Attendance", `/courses/${course.id}/attendance`],
              ...(session.role === "INSTRUCTOR" ? [] : [["Polls", `/courses/${course.id}/polls`]]),
              ["Resources", "#resources"],
              ["Announcements", "#announcements"],
              ["Q&A", "#qa"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-[#e8ddff] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#6b00ff] hover:text-[#6b00ff]"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </Panel>

      <section className="grid gap-6">
        <div className="space-y-6">
          <Panel id="overview" title="Course Overview" subtitle="Course setup, enrollment visibility, and core identity.">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="font-heading text-lg text-slate-950">Learners</p>
              <div className="mt-3 space-y-3">
                {course.enrollments.length ? (
                  course.enrollments.map((enrollment: any) => (
                    <div key={enrollment.id} className="rounded-[20px] border border-[#efe6ff] bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{enrollment.student.fullName}</p>
                          <p className="mt-1 text-sm text-slate-600">{enrollment.student.email}</p>
                          <p className="mt-1 text-sm text-slate-600">{enrollment.student.studentId ?? "No student ID"}</p>
                          {canManage ? (
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="slate">
                                  {calculateCourseProgress(
                                    enrollment.student.lessonPageProgress.length,
                                    managedStudentTotalPages,
                                  ).percentage}% progress
                                </Badge>
                                <Badge tone="purple">
                                  {enrollment.student.lessonPageProgress.length} of {managedStudentTotalPages} pages done
                                </Badge>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-[#f1e8ff]">
                                <div
                                  className="h-full rounded-full bg-[linear-gradient(135deg,#159957,#38ef7d)] transition-all"
                                  style={{
                                    width: `${calculateCourseProgress(
                                      enrollment.student.lessonPageProgress.length,
                                      managedStudentTotalPages,
                                    ).percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {canManage ? (
                          <ApiActionButton
                            action="/api/enrollments"
                            method="DELETE"
                            payload={{ enrollmentId: enrollment.id }}
                            successMessage="Student unenrolled."
                            label="Unenroll"
                            pendingLabel="Removing..."
                            tone="danger"
                            confirmMessage={`Unenroll ${enrollment.student.fullName} from ${course.title}?`}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No learners enrolled" description="Enrollments attached to this course will appear here." />
                )}
              </div>
            </div>

            {canManage ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => toggleComposer("course")} className={getComposerButtonClass("course")}>
                    {activeComposer === "course" ? "Close Course Editor" : "Edit Course"}
                  </button>
                </div>

                {activeComposer === "course" ? (
                  <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                    <ApiForm
                      action={`/api/courses/${course.id}`}
                      method="PATCH"
                      submitLabel="Save course"
                      successMessage="Course updated."
                      resetOnSuccess={false}
                      className="grid gap-4"
                      onSuccess={() => setActiveComposer(null)}
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
                      {session.role === "ADMIN" && (
                        <>
                          <FormField
                            label="Primary instructor"
                            name="instructorId"
                            as="select"
                            defaultValue={course.instructorId ?? ""}
                            options={[
                              { label: "No instructor yet", value: "" },
                              ...instructors.map((instructor: any) => ({
                                label: `${instructor.fullName} (${instructor.role})`,
                                value: instructor.id,
                              })),
                            ]}
                          />
                          <label className="block">
                            <span className="text-sm font-semibold text-slate-700">Additional instructors/admins</span>
                            <div className="mt-2 grid gap-2 rounded-[20px] border border-[#e8ddff] bg-white p-4">
                              {instructors.map((instructor: any) => (
                                <label key={instructor.id} className="flex items-center gap-3 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    name="managerIds"
                                    value={instructor.id}
                                    defaultChecked={course.courseManagers.some((manager: any) => manager.user.id === instructor.id)}
                                  />
                                  <span>{instructor.fullName} ({instructor.role})</span>
                                </label>
                              ))}
                            </div>
                          </label>
                        </>
                      )}
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
                      <WeekdayCheckboxGroup name="attendanceDays" defaultValues={course.attendanceDays} />
                    </ApiForm>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3 border-t border-[#f1e8ff] pt-4">
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
            ) : null}
          </div>
        </Panel>

        <Panel id="lessons" title="Modules" subtitle="Each lesson now behaves like a module, and each module can contain multiple ordered pages.">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {course.lessons.length ? (
                course.lessons.map((lesson: any) => (
                  <div key={lesson.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {lesson.title}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {lesson.content.length > 180 ? `${lesson.content.slice(0, 180)}...` : lesson.content}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge tone={lesson.status === "PUBLISHED" ? "green" : "purple"}>{lesson.status}</Badge>
                          <Badge tone="slate">{lesson.pages.length} pages</Badge>
                          <Badge tone="slate">{lesson.resources.length} resources</Badge>
                        </div>
                      </div>
                      <Link
                        href={`/courses/${course.id}/lessons/${lesson.id}`}
                        className="inline-flex rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff] transition hover:bg-[#f2e8ff]"
                      >
                        Open module
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No lessons yet" description="Create the first lesson to start structuring this course." />
              )}
            </div>

            {canManage ? (
              <div className="space-y-4">
                <button type="button" onClick={() => toggleComposer("module")} className={getComposerButtonClass("module")}>
                  {activeComposer === "module" ? "Close Module Builder" : "Add Module"}
                </button>

                {activeComposer === "module" ? (
                  <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                    <ApiForm
                      action="/api/lessons"
                      submitLabel="Add module"
                      successMessage="Module added."
                      className="grid gap-4"
                      onSuccess={() => setActiveComposer(null)}
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
                        rows={8}
                        placeholder="This lesson can include text, links, embed code, image references, and learning instructions."
                        required
                      />
                    </ApiForm>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel id="resources" title="Resources" subtitle="Course files and links live here at the course level.">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {course.resources.length ? (
                course.resources.map((resource: any) => (
                  <div key={resource.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="purple">{resource.type}</Badge>
                    </div>
                    <p className="mt-3 font-semibold text-slate-950">{resource.title}</p>
                    {resource.externalUrl ? (
                      <a
                        href={resource.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-[#6b00ff]"
                      >
                        Open external resource
                      </a>
                    ) : resource.fileUrl ? (
                      <div className="mt-3">
                        <FileDisplay url={resource.fileUrl} title={resource.title} />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">Internal resource</p>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState title="No resources yet" description="Add files, links, and media references for this course." />
              )}
            </div>

            {canManage ? (
              <div className="space-y-4">
                <button type="button" onClick={() => toggleComposer("resource")} className={getComposerButtonClass("resource")}>
                  {activeComposer === "resource" ? "Close Resource Builder" : "Add Resource"}
                </button>

                {activeComposer === "resource" ? (
                  <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                    <ApiForm
                      action="/api/resources"
                      submitLabel="Add resource"
                      successMessage="Resource added."
                      className="grid gap-4"
                      onSuccess={() => setActiveComposer(null)}
                    >
                      <input type="hidden" name="courseId" value={course.id} />
                      <FormField label="Resource title" name="title" required />
                    <FormField
                        label="Type"
                        name="type"
                        as="select"
                        defaultValue="PDF"
                        options={[
                          { label: "PDF", value: "PDF" },
                          { label: "DOC", value: "DOC" },
                          { label: "DOCX", value: "DOCX" },
                          { label: "Video link", value: "VIDEO_LINK" },
                          { label: "External link", value: "EXTERNAL_LINK" },
                          { label: "Image", value: "IMAGE" },
                          { label: "Other", value: "OTHER" },
                        ]}
                      />
                      <FileUploadField
                        label="Resource file"
                        name="fileUrl"
                        helperText="Upload a PDF, DOC, DOCX, TXT, CSV, or image."
                      />
                      <FormField label="External URL" name="externalUrl" placeholder="https://..." />
                    </ApiForm>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel id="announcements" title="Announcements" subtitle="Course announcements now live inside the course shell where learners expect them.">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {course.announcements.length ? (
                course.announcements.map((announcement: any) => (
                  <article key={announcement.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="slate">{announcement.createdBy.role}</Badge>
                      <Badge tone="purple">{formatShortDate(announcement.createdAt)}</Badge>
                      <Badge tone={announcement.reads.length ? "green" : "purple"}>
                        {announcement.reads.length ? "Read" : "Unread"}
                      </Badge>
                    </div>
                    <p className="mt-3 font-semibold text-slate-950">{announcement.title}</p>
                    {announcement.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={announcement.imageUrl}
                        alt={announcement.title}
                        className="mt-3 h-auto max-h-[320px] w-full rounded-[24px] object-cover"
                      />
                    ) : null}
                    <p className="mt-2 text-sm text-slate-600">{announcement.content}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {announcement.createdBy.fullName}
                    </p>
                    {canManage ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {!announcement.reads.length ? (
                          <MarkAnnouncementReadButton announcementId={announcement.id} />
                        ) : null}
                        <ApiActionButton
                          action={`/api/announcements/${announcement.id}`}
                          method="DELETE"
                          successMessage="Announcement removed."
                          label="Delete announcement"
                          pendingLabel="Deleting..."
                          tone="danger"
                          confirmMessage={`Delete announcement "${announcement.title}"?`}
                        />
                      </div>
                    ) : !announcement.reads.length ? (
                      <div className="mt-4">
                        <MarkAnnouncementReadButton announcementId={announcement.id} />
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyState title="No announcements yet" description="Post course news, reminders, and updates here." />
              )}
            </div>

            {canManage ? (
              <div className="space-y-4">
                <button type="button" onClick={() => toggleComposer("announcement")} className={getComposerButtonClass("announcement")}>
                  {activeComposer === "announcement" ? "Close Announcement Editor" : "Post Announcement"}
                </button>

                {activeComposer === "announcement" ? (
                  <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                    <ApiForm
                      action="/api/announcements"
                      submitLabel="Publish announcement"
                      successMessage="Announcement posted."
                      className="grid gap-4"
                      onSuccess={() => setActiveComposer(null)}
                    >
                      <input type="hidden" name="courseId" value={course.id} />
                      <FormField label="Title" name="title" required />
                      <ImageUploadField
                        label="Announcement image"
                        name="imageUrl"
                        helperText="Upload an optional image to attach to this announcement."
                        emptyLabel="No image"
                        maxFileSizeKb={750}
                        previewClassName="h-24 w-40 rounded-[20px]"
                      />
                      <FormField label="Message" name="content" as="textarea" rows={6} required />
                    </ApiForm>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel id="qa" title="Course Q&A" subtitle="Questions and replies stay tied to this course, not mixed into a platform-wide stream.">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              {course.questions.length ? (
                course.questions.map((question: any) => (
                  <article key={question.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="slate">{question.askedBy.role}</Badge>
                      <Badge tone={question.answers.length ? "green" : "red"}>
                        {question.answers.length ? "Answered" : "Awaiting reply"}
                      </Badge>
                    </div>
                    <p className="mt-3 font-semibold text-slate-950">{question.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{question.content}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Asked by {question.askedBy.fullName}
                    </p>

                    <div className="mt-4 space-y-3">
                      {question.answers.map((answer: any) => (
                        <div key={answer.id} className="rounded-[20px] bg-[#faf7ff] p-4">
                          <p className="text-sm text-slate-700">{answer.content}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {answer.answeredBy.fullName} | {answer.answeredBy.role}
                          </p>
                        </div>
                      ))}
                    </div>

                    {session.role !== "STUDENT" && (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReplyQuestionId((currentQuestionId) =>
                                currentQuestionId === question.id ? null : question.id,
                              )
                            }
                            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                              activeReplyQuestionId === question.id
                                ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                                : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                            }`}
                          >
                            {activeReplyQuestionId === question.id ? "Close Reply Editor" : "Reply"}
                          </button>
                          <ApiActionButton
                            action={`/api/questions/${question.id}`}
                            method="DELETE"
                            successMessage="Question removed."
                            label="Delete Q&A"
                            pendingLabel="Deleting..."
                            tone="danger"
                            confirmMessage={`Delete question "${question.title}" and all replies?`}
                          />
                        </div>
                        {activeReplyQuestionId === question.id ? (
                          <div className="rounded-[20px] border border-[#e8ddff] bg-[#fcfaff] p-4">
                            <ApiForm
                              action="/api/questions/answer"
                              submitLabel="Post answer"
                              successMessage="Answer posted."
                              className="grid gap-3"
                              onSuccess={() => setActiveReplyQuestionId(null)}
                            >
                              <input type="hidden" name="questionId" value={question.id} />
                              <FormField label="Answer" name="content" as="textarea" rows={4} required />
                            </ApiForm>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <EmptyState title="No questions yet" description="Questions asked for this course will appear here." />
              )}
            </div>

            {session.role === "STUDENT" ? (
              <div className="space-y-4">
                <button type="button" onClick={() => toggleComposer("question")} className={getComposerButtonClass("question")}>
                  {activeComposer === "question" ? "Close Question Form" : "Ask Question"}
                </button>

                {activeComposer === "question" ? (
                  <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                    <ApiForm
                      action="/api/questions"
                      submitLabel="Ask question"
                      successMessage="Question posted."
                      className="grid gap-4"
                      onSuccess={() => setActiveComposer(null)}
                    >
                      <input type="hidden" name="courseId" value={course.id} />
                      <FormField label="Title" name="title" required />
                      <FormField label="Question details" name="content" as="textarea" rows={6} required />
                    </ApiForm>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-5">
                <p className="font-heading text-xl text-slate-950">Instructor moderation</p>
                <p className="mt-2 text-sm text-slate-600">
                  Replies posted here notify the learner and keep the full discussion connected to this course.
                </p>
              </div>
            )}
          </div>
        </Panel>
        </div>

      </section>
    </DashboardLayout>
  );
}












