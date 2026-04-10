import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import Link from "next/link";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FileDisplay from "@/components/ui/FileDisplay";
import FileUploadField from "@/components/ui/FileUploadField";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Panel from "@/components/ui/Panel";
import QuizBuilderField from "@/components/ui/QuizBuilderField";
import RichTextEditorField from "@/components/ui/RichTextEditorField";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type LessonNavigatorItem = {
  id: string;
  title: string;
  order: number;
  status: string;
  pages: { id: string }[];
};

type LessonPageResource = {
  id: string;
  title: string;
  type: string;
  externalUrl: string | null;
  fileUrl: string | null;
};

type ModulePageItem = {
  id: string;
  title: string;
  body: string;
  order: number;
  resources: LessonPageResource[];
};

function getPlainTextPreview(content: string) {
  const plainText = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) {
    return "Open this page to view its content.";
  }

  return plainText.length > 180 ? `${plainText.slice(0, 180)}...` : plainText;
}

type ModuleQuiz = {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  maxAttempts: number;
};

type ModuleAssignment = {
  id: string;
  title: string;
  description: string;
  submissionType: string;
};

type ModuleActivityItem = {
  id: string;
  title: string;
};

type LessonCourseSidebar = {
  id: string;
  title: string;
  announcements: ModuleActivityItem[];
  questions: ModuleActivityItem[];
};

type LessonCourseData = {
  id: string;
  title: string;
  instructor: {
    id: string;
    fullName: string;
  } | null;
  lessons: LessonNavigatorItem[];
};

type LessonData = {
  id: string;
  title: string;
  order: number;
  status: string;
  content: string;
  pages: ModulePageItem[];
  resources: LessonPageResource[];
  assignments: ModuleAssignment[];
  quizzes: ModuleQuiz[];
  course: LessonCourseSidebar;
};

export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<{ session: NonNullable<ReturnType<typeof getSessionFromPageContext>>; course: unknown; lesson: unknown }>> {
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
  const lessonId = String(ctx.params?.lessonId);

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(session.role === "STUDENT"
        ? { status: "PUBLISHED", enrollments: { some: { studentId: session.userId } } }
        : session.role === "INSTRUCTOR"
          ? getManagedCourseWhere(session)
          : {}),
    },
    include: {
      instructor: {
        select: { id: true, fullName: true },
      },
      courseManagers: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
      lessons: {
        orderBy: { order: "asc" },
        where: session.role === "STUDENT" ? { status: "PUBLISHED" } : undefined,
        select: {
          id: true,
          title: true,
          order: true,
          status: true,
          pages: {
            select: {
              id: true,
            },
          },
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

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      courseId,
      ...(session.role === "STUDENT" ? { status: "PUBLISHED" } : {}),
    },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: {
          resources: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      resources: {
        orderBy: { createdAt: "desc" },
      },
      assignments: {
        where: session.role === "STUDENT" ? { status: "PUBLISHED" } : undefined,
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      },
      quizzes: {
        where:
          session.role === "STUDENT"
            ? { status: "PUBLISHED", archivedAt: null }
            : { archivedAt: null },
        orderBy: { createdAt: "desc" },
      },
      course: {
        select: {
          id: true,
          title: true,
          announcements: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              title: true,
            },
          },
          questions: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!lesson) {
    return {
      redirect: {
        destination: `/courses/${courseId}`,
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
      course: serialize(course),
      lesson: serialize(lesson),
    },
  };
}

type LessonPageProps = {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  course: LessonCourseData;
  lesson: LessonData;
};

type ComposerType = "page" | "resource" | "quiz" | "assignment" | null;

export default function LessonPage({
  session,
  course,
  lesson,
}: LessonPageProps) {
  const canManage = canManageCourse(
    session,
    [course.instructor?.id, ...(course as any).courseManagers?.map((manager: any) => manager.user.id) ?? []].filter(Boolean) as string[],
  );
  const lessonIndex = course.lessons.findIndex((currentLesson) => currentLesson.id === lesson.id);
  const previousLesson = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 && lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null;
  const [activeComposer, setActiveComposer] = useState<ComposerType>(null);

  function toggleComposer(composer: Exclude<ComposerType, null>) {
    setActiveComposer((currentComposer) => (currentComposer === composer ? null : composer));
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={lesson.title}
      description={`Module inside ${course.title}.`}
    >
      <Panel className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={lesson.status === "PUBLISHED" ? "green" : "purple"}>{lesson.status}</Badge>
              <Badge tone="slate">{lesson.pages.length} content pages</Badge>
              <Badge tone="slate">{lesson.resources.length} lesson resources</Badge>
              <Badge tone="slate">{lesson.quizzes.length} quizzes</Badge>
              <Badge tone="slate">{lesson.assignments.length} assignments</Badge>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{lesson.content}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/courses/${course.id}`}
              className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Back to course
            </Link>
            {previousLesson ? (
              <Link
                href={`/courses/${course.id}/lessons/${previousLesson.id}`}
                className="rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
              >
                Previous module
              </Link>
            ) : null}
            {nextLesson ? (
              <Link
                href={`/courses/${course.id}/lessons/${nextLesson.id}`}
                className="rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-4 py-3 text-sm font-semibold text-white"
              >
                Next module
              </Link>
            ) : null}
            {canManage ? (
              <ApiActionButton
                action={`/api/lessons/${lesson.id}`}
                method="DELETE"
                successMessage="Module deleted."
                label="Delete module"
                pendingLabel="Deleting..."
                tone="danger"
                confirmMessage={`Delete module "${lesson.title}"? This action cannot be undone.`}
              />
            ) : null}
          </div>
        </div>
      </Panel>

      <section className="space-y-6">
        {canManage ? (
          <Panel
            title="Module Settings"
            subtitle="Edit the module name, description, and publish state."
          >
            <ApiForm
              action={`/api/lessons/${lesson.id}`}
              method="PATCH"
              submitLabel="Save module"
              successMessage="Module updated."
              resetOnSuccess={false}
              className="grid gap-4"
            >
              <FormField label="Module name" name="title" defaultValue={lesson.title} required />
              <FormField
                label="Status"
                name="status"
                as="select"
                defaultValue={lesson.status}
                options={[
                  { label: "Draft", value: "DRAFT" },
                  { label: "Published", value: "PUBLISHED" },
                ]}
              />
              <FormField
                label="Description"
                name="content"
                as="textarea"
                rows={6}
                defaultValue={lesson.content}
                required
              />
            </ApiForm>
          </Panel>
        ) : null}

        {canManage ? (
          <Panel
            title="Module Builder"
            subtitle="Use focused actions to add learning content without crowding the page."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => toggleComposer("page")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    activeComposer === "page"
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                  }`}
                >
                  {activeComposer === "page" ? "Close Page Editor" : "Add Page"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleComposer("quiz")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    activeComposer === "quiz"
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                  }`}
                >
                  {activeComposer === "quiz" ? "Close Quiz Editor" : "Add Quiz"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleComposer("assignment")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    activeComposer === "assignment"
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                  }`}
                >
                  {activeComposer === "assignment" ? "Close Assignment Editor" : "Add Assignment"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleComposer("resource")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    activeComposer === "resource"
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                  }`}
                >
                  {activeComposer === "resource" ? "Close Resource Editor" : "Add Resource"}
                </button>
              </div>

              {activeComposer === "page" ? (
                <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                  <ApiForm
                    action="/api/lesson-pages"
                    submitLabel="Save module page"
                    successMessage="Module page added."
                    className="grid gap-4"
                    onSuccess={() => setActiveComposer(null)}
                  >
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <FormField label="Page title" name="title" required />
                    <RichTextEditorField
                      label="Page content"
                      name="body"
                      required
                      helperText="Build the module page with headings, text, lists, links, tables, and embeds."
                    />
                    <FormField label="Resource link" name="externalUrl" placeholder="https://..." />
                    <FormField label="Embed URL" name="embedUrl" placeholder="https://www.youtube.com/embed/..." />
                    <ImageUploadField
                      label="Page image"
                      name="imageUrl"
                      helperText="Upload an optional image for this content page."
                      emptyLabel="No image"
                      maxFileSizeKb={750}
                      previewClassName="h-24 w-40 rounded-[20px]"
                    />
                  </ApiForm>
                </div>
              ) : null}

              {activeComposer === "quiz" ? (
                <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                  <ApiForm
                    action="/api/quizzes"
                    submitLabel="Create quiz"
                    successMessage="Quiz created."
                    className="grid gap-4"
                    onSuccess={() => setActiveComposer(null)}
                  >
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <FormField label="Title" name="title" required />
                    <FormField label="Time limit (minutes)" name="timeLimitMinutes" type="number" defaultValue="20" required />
                    <FormField label="Max attempts" name="maxAttempts" type="number" defaultValue="1" />
                    <FormField
                      label="Status"
                      name="status"
                      as="select"
                      defaultValue="DRAFT"
                      options={[
                        { label: "Draft", value: "DRAFT" },
                        { label: "Published", value: "PUBLISHED" },
                      ]}
                    />
                    <FormField label="Due date" name="dueAt" type="datetime-local" />
                    <FormField label="Description" name="description" as="textarea" />
                    <FormField label="Instructions" name="instructions" as="textarea" />
                    <QuizBuilderField />
                  </ApiForm>
                </div>
              ) : null}

              {activeComposer === "assignment" ? (
                <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                  <ApiForm
                    action="/api/assignments"
                    submitLabel="Create assignment"
                    successMessage="Assignment created."
                    className="grid gap-4"
                    onSuccess={() => setActiveComposer(null)}
                  >
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <FormField label="Title" name="title" required />
                    <FormField
                      label="Submission type"
                      name="submissionType"
                      as="select"
                      defaultValue="FILE"
                      options={[
                        { label: "File", value: "FILE" },
                        { label: "Link", value: "LINK" },
                        { label: "Text", value: "TEXT" },
                      ]}
                    />
                    <FormField
                      label="Status"
                      name="status"
                      as="select"
                      defaultValue="DRAFT"
                      options={[
                        { label: "Draft", value: "DRAFT" },
                        { label: "Published", value: "PUBLISHED" },
                      ]}
                    />
                    <FormField label="Due date" name="dueAt" type="datetime-local" />
                    <FormField label="Description" name="description" as="textarea" required />
                    <FormField label="Instructions" name="instructions" as="textarea" />
                    <FileUploadField
                      label="Assignment attachment"
                      name="attachmentUrl"
                      helperText="Upload a PDF, DOC, DOCX, TXT, CSV, or image."
                    />
                  </ApiForm>
                </div>
              ) : null}

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
                    <input type="hidden" name="lessonId" value={lesson.id} />
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
          </Panel>
        ) : null}

        <Panel title="Module Pages" subtitle="Ordered learning pages for this module.">
          <div className="space-y-3">
            {lesson.pages.length ? (
              lesson.pages.map((page) => (
                <div key={page.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="purple">Page</Badge>
                        <Badge tone="slate">{page.resources.length} resources</Badge>
                      </div>
                      <p className="mt-3 font-semibold text-slate-950">{page.title}</p>
                      <p className="mt-2 text-sm text-slate-600">{getPlainTextPreview(page.body)}</p>
                    </div>
                    <Link
                      href={`/courses/${course.id}/lessons/${lesson.id}/pages/${page.id}`}
                      className="inline-flex rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                    >
                      Open page
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No module pages yet" description="Add ordered pages like introductions, concept notes, videos, or walkthroughs." />
            )}
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Module Resources" subtitle="Files and links attached directly to this module.">
            {lesson.resources.length ? (
              <div className="space-y-3">
                {lesson.resources.map((resource) => (
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
                ))}
              </div>
            ) : (
              <EmptyState title="No module resources yet" description="Attach supporting files and links for this module." />
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Assessments" subtitle="Quizzes and assignments attached to this module.">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-950">Quizzes</p>
                  <div className="mt-3 space-y-3">
                    {lesson.quizzes.length ? (
                      lesson.quizzes.map((quiz) => (
                        <div key={quiz.id} className="rounded-[20px] border border-[#efe6ff] bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="purple">Quiz</Badge>
                            <Badge tone="slate">{quiz.timeLimitMinutes ?? "No"} min limit</Badge>
                            <Badge tone="slate">{quiz.maxAttempts ?? "Unlimited"} attempts</Badge>
                          </div>
                          <p className="mt-3 font-semibold text-slate-950">{quiz.title}</p>
                          {quiz.description ? <p className="mt-2 text-sm text-slate-600">{quiz.description}</p> : null}
                          <Link
                            href={`/quizzes/${quiz.id}?mode=manage`}
                            className="mt-4 inline-flex rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                          >
                            Open quiz
                          </Link>
                        </div>
                      ))
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No quizzes in this module yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-950">Assignments</p>
                  <div className="mt-3 space-y-3">
                    {lesson.assignments.length ? (
                      lesson.assignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-[20px] border border-[#efe6ff] bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="purple">Assignment</Badge>
                            <Badge tone="slate">{assignment.submissionType}</Badge>
                          </div>
                          <p className="mt-3 font-semibold text-slate-950">{assignment.title}</p>
                          <p className="mt-2 text-sm text-slate-600">{assignment.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No assignments in this module yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Course Activity">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-950">Recent announcements</p>
                  <div className="mt-2 space-y-2">
                    {lesson.course.announcements.length ? (
                      lesson.course.announcements.map((announcement) => (
                        <div key={announcement.id} className="rounded-[18px] bg-[#faf7ff] px-4 py-3 text-sm text-slate-700">
                          {announcement.title}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No announcements yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-950">Recent Q&A</p>
                  <div className="mt-2 space-y-2">
                    {lesson.course.questions.length ? (
                      lesson.course.questions.map((question) => (
                        <div key={question.id} className="rounded-[18px] bg-[#faf7ff] px-4 py-3 text-sm text-slate-700">
                          {question.title}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No course questions yet.</p>
                    )}
                  </div>
                </div>

                <Link
                  href={`/courses/${course.id}#announcements`}
                  className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                >
                  Return to course activity
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
