import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Panel from "@/components/ui/Panel";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { formatShortDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const [courses, announcements] = await Promise.all([
      prisma.course.findMany({
        where:
          session.role === "STUDENT"
            ? { status: "PUBLISHED", enrollments: { some: { studentId: session.userId } } }
            : session.role === "INSTRUCTOR"
              ? getManagedCourseWhere(session)
              : {},
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      prisma.announcement.findMany({
        where:
          session.role === "STUDENT"
            ? { course: { status: "PUBLISHED", enrollments: { some: { studentId: session.userId } } } }
            : session.role === "INSTRUCTOR"
              ? { course: getManagedCourseWhere(session) }
              : {},
        include: {
          course: true,
          createdBy: { select: { fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      courses: serialize(courses),
      announcements: serialize(announcements),
    };
  });
}

export default function AnnouncementsPage({
  session,
  courses,
  announcements,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const canManage = session.role !== "STUDENT";

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Announcements"
      description="Keep learners aligned with course updates, reminders, and important communications."
    >
      {canManage ? (
        <Panel title="Post Announcement" className="mb-6">
          <ApiForm
            action="/api/announcements"
            submitLabel="Publish announcement"
            successMessage="Announcement posted."
            className="grid gap-4 md:grid-cols-2"
          >
            <FormField
              label="Course"
              name="courseId"
              as="select"
              options={courses.map((course) => ({ label: course.title, value: course.id }))}
              required
            />
            <FormField label="Title" name="title" required />
            <div className="md:col-span-2">
              <ImageUploadField
                label="Announcement image"
                name="imageUrl"
                helperText="Upload an optional image to attach to this announcement."
                emptyLabel="No image"
                maxFileSizeKb={750}
                previewClassName="h-24 w-40 rounded-[20px]"
              />
            </div>
            <div className="md:col-span-2">
              <FormField label="Message" name="content" as="textarea" rows={6} required />
            </div>
          </ApiForm>
        </Panel>
      ) : null}

      <Panel title="Recent Announcements">
        {!announcements.length ? (
          <EmptyState title="No announcements yet" description="Announcements posted to your courses will appear here." />
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{announcement.course.title}</Badge>
                  <Badge tone="slate">{announcement.createdBy.role}</Badge>
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
                  {announcement.createdBy.fullName} • {formatShortDate(announcement.createdAt)}
                </p>
                {canManage ? (
                  <div className="mt-4">
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
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}
