import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Panel from "@/components/ui/Panel";
import RichTextEditorField from "@/components/ui/RichTextEditorField";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { toEmbeddableUrl } from "@/lib/media";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type LessonPageNavItem = {
  id: string;
  title: string;
  order: number;
};

type LessonContentResource = {
  id: string;
  type: string;
  title: string;
  externalUrl: string | null;
  fileUrl: string | null;
};

type LessonContentLesson = {
  id: string;
  title: string;
  course: {
    id: string;
    title: string;
    instructorId: string | null;
    createdById?: string;
    courseManagers?: Array<{ userId: string }>;
  };
  pages: LessonPageNavItem[];
};

type LessonContentData = {
  id: string;
  title: string;
  order: number;
  body: string;
  imageUrl: string | null;
  externalUrl: string | null;
  embedUrl: string | null;
  resources: LessonContentResource[];
};

function toDisplayHtml(content: string) {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }

  return content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noreferrer">$1</a>',
    );
}

function getEmbedType(embedUrl: string) {
  try {
    const parsed = new URL(embedUrl);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be") || hostname.includes("vimeo.com")) {
      return "iframe";
    }

    if (pathname.endsWith(".mp4") || pathname.endsWith(".webm") || pathname.endsWith(".ogg")) {
      return "video";
    }
  } catch {
    return "link";
  }

  return "link";
}

export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<{ session: NonNullable<ReturnType<typeof getSessionFromPageContext>>; lesson: unknown; page: unknown }>> {
  const session = getSessionFromPageContext(ctx);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  if (!assertRoleAccess(session, ["ADMIN", "INSTRUCTOR", "STUDENT"])) {
    return { redirect: { destination: getDefaultRouteForRole(session.role), permanent: false } };
  }

  const courseId = String(ctx.params?.courseId);
  const lessonId = String(ctx.params?.lessonId);
  const pageId = String(ctx.params?.pageId);

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      courseId,
      ...(session.role === "STUDENT"
        ? { course: { status: "PUBLISHED", enrollments: { some: { studentId: session.userId } } }, status: "PUBLISHED" }
        : session.role === "INSTRUCTOR"
          ? { course: getManagedCourseWhere(session) }
          : {}),
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          instructorId: true,
          createdById: true,
          courseManagers: {
            select: {
              userId: true,
            },
          },
        },
      },
      pages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
        },
      },
    },
  });

  if (!lesson) {
    return { redirect: { destination: "/courses", permanent: false } };
  }

  const page = await prisma.lessonPage.findFirst({
    where: {
      id: pageId,
      lessonId,
    },
    include: {
      resources: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!page) {
    return { redirect: { destination: `/courses/${courseId}/lessons/${lessonId}`, permanent: false } };
  }

  return {
    props: {
      session,
      lesson: serialize(lesson),
      page: serialize(page),
    },
  };
}

export default function LessonContentPage({
  session,
  lesson,
  page,
}: {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  lesson: LessonContentLesson;
  page: LessonContentData;
}) {
  const router = useRouter();
  const pageIndex = lesson.pages.findIndex((currentPage) => currentPage.id === page.id);
  const previousPage = pageIndex > 0 ? lesson.pages[pageIndex - 1] : null;
  const nextPage = pageIndex >= 0 && pageIndex < lesson.pages.length - 1 ? lesson.pages[pageIndex + 1] : null;
  const canManage = canManageCourse(
    session,
    [lesson.course.instructorId, lesson.course.createdById, ...(lesson.course.courseManagers ?? []).map((manager) => manager.userId)].filter(Boolean) as string[],
  );
  const normalizedEmbedUrl = page.embedUrl
    ? (() => {
        try {
          return toEmbeddableUrl(page.embedUrl);
        } catch {
          return page.embedUrl;
        }
      })()
    : null;

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={page.title}
      description={`Module page inside ${lesson.title}.`}
    >
      <Panel className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">{lesson.title}</Badge>
              <Badge tone="slate">Page</Badge>
            </div>
            <div className="max-w-4xl space-y-4">
              <div
                className="rich-content text-sm leading-7 text-slate-700"
                dangerouslySetInnerHTML={{ __html: toDisplayHtml(page.body) }}
              />
              {page.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={page.imageUrl} alt={page.title} className="h-auto max-h-[360px] w-full rounded-[24px] object-cover" />
              ) : null}
              {page.externalUrl ? (
                <a href={page.externalUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-[#6b00ff]">
                  Open linked URL
                </a>
              ) : null}
              {normalizedEmbedUrl ? (
                <div className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Embedded media</p>
                  {getEmbedType(normalizedEmbedUrl) === "iframe" ? (
                    <div className="mt-3 overflow-hidden rounded-[20px] border border-[#efe6ff]">
                      <iframe
                        src={normalizedEmbedUrl}
                        title={page.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="aspect-video w-full border-0"
                      />
                    </div>
                  ) : null}
                  {getEmbedType(normalizedEmbedUrl) === "video" ? (
                    <video src={normalizedEmbedUrl} controls className="mt-3 aspect-video w-full rounded-[20px] border border-[#efe6ff] bg-black" />
                  ) : null}
                  {getEmbedType(normalizedEmbedUrl) === "link" ? (
                    <a
                      href={normalizedEmbedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex break-all text-sm font-semibold text-[#6b00ff] underline decoration-[#d9c2ff] underline-offset-4"
                    >
                      {normalizedEmbedUrl}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/courses/${lesson.course.id}/lessons/${lesson.id}`} className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              Back to module
            </Link>
            {previousPage ? (
              <Link href={`/courses/${lesson.course.id}/lessons/${lesson.id}/pages/${previousPage.id}`} className="rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]">
                Previous page
              </Link>
            ) : null}
            {nextPage ? (
              <Link href={`/courses/${lesson.course.id}/lessons/${lesson.id}/pages/${nextPage.id}`} className="rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-4 py-3 text-sm font-semibold text-white">
                Next page
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>

      {canManage ? (
        <Panel title="Edit Module Page" subtitle="Update the page body with headings, lists, tables, links, and embeds.">
          <ApiForm
            action={`/api/lesson-pages/${page.id}`}
            method="PATCH"
            submitLabel="Save page"
            successMessage="Module page updated."
            resetOnSuccess={false}
            className="grid gap-4"
          >
            <FormField label="Page title" name="title" defaultValue={page.title} required />
            <RichTextEditorField
              label="Page content"
              name="body"
              initialValue={page.body}
              required
              helperText="Use headings, paragraphs, lists, tables, links, and embeds to shape this page."
            />
            <FormField label="External URL" name="externalUrl" defaultValue={page.externalUrl ?? ""} placeholder="https://..." />
            <FormField label="Embed URL" name="embedUrl" defaultValue={page.embedUrl ?? ""} placeholder="https://www.youtube.com/embed/..." />
            <ImageUploadField
              label="Page image"
              name="imageUrl"
              defaultValue={page.imageUrl ?? ""}
              helperText="Upload an optional image for this content page."
              emptyLabel="No image"
              maxFileSizeKb={750}
              previewClassName="h-24 w-40 rounded-[20px]"
            />
          </ApiForm>

          <div className="mt-5 flex flex-wrap gap-3 border-t border-[#f1e8ff] pt-4">
            <ApiActionButton
              action={`/api/lesson-pages/${page.id}`}
              method="DELETE"
              successMessage="Module page deleted."
              label="Delete page"
              pendingLabel="Deleting..."
              tone="danger"
              confirmMessage={`Delete ${page.title}? This cannot be undone.`}
            />
            <button
              type="button"
              onClick={() => void router.push(`/courses/${lesson.course.id}/lessons/${lesson.id}`)}
              className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Back to module manager
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel title="Page Resources" subtitle="Files and links attached directly to this page.">
        {page.resources.length ? (
          <div className="space-y-3">
            {page.resources.map((resource) => (
              <div key={resource.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{resource.type}</Badge>
                </div>
                <p className="mt-3 font-semibold text-slate-950">{resource.title}</p>
                <p className="mt-2 break-all text-sm text-slate-600">{resource.externalUrl || resource.fileUrl || "Internal resource"}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No page resources yet" description="Add supporting resources from the module page editor." />
        )}
      </Panel>
    </DashboardLayout>
  );
}
