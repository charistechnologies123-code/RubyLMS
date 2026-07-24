import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FileDisplay from "@/components/ui/FileDisplay";
import FileUploadField from "@/components/ui/FileUploadField";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { formatDate, formatShortDate } from "@/lib/format";
import { canStudentSubmitBeforeDueDate, getVisibleAssignmentWhere, getVisibleCourseWhere } from "@/lib/lms";
import { toLmsDateTimeLocalValue } from "@/lib/lmsTime";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const [courses, assignments] = await Promise.all([
      prisma.course.findMany({
        where: getVisibleCourseWhere(session),
        select: {
          id: true,
          title: true,
        },
        orderBy: { title: "asc" },
      }),
      prisma.assignment.findMany({
        where: getVisibleAssignmentWhere(session),
        include: {
          course: true,
          submissions:
            session.role === "STUDENT"
              ? {
                  where: { studentId: session.userId },
                }
              : {
                  include: {
                    student: {
                      select: {
                        fullName: true,
                        studentId: true,
                      },
                    },
                  },
                },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      }),
    ]);

    return {
      courses: serialize(courses),
      assignments: serialize(assignments),
    };
  });
}

export default function AssignmentsPage({
  session,
  courses,
  assignments,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const canManage = session.role !== "STUDENT";
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [activeSubmissionAssignmentId, setActiveSubmissionAssignmentId] = useState<string | null>(null);
  const [activeEditAssignmentId, setActiveEditAssignmentId] = useState<string | null>(null);

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Assignments"
      description="Publish assessments, collect submissions, and manage grading with course-level visibility."
    >
      {canManage && (
        <Panel title="Assignment Builder" className="mb-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowCreateAssignment((current) => !current)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                showCreateAssignment
                  ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                  : "border border-[#e8ddff] bg-white text-[#6b00ff]"
              }`}
            >
              {showCreateAssignment ? "Close Assignment Builder" : "Create Assignment"}
            </button>

            {showCreateAssignment ? (
              <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                <ApiForm
                  action="/api/assignments"
                  submitLabel="Create assignment"
                  successMessage="Assignment created."
                  className="grid gap-4 md:grid-cols-2"
                  onSuccess={() => setShowCreateAssignment(false)}
                >
                  <FormField
                    label="Course"
                    name="courseId"
                    as="select"
                    options={courses.map((course) => ({ label: course.title, value: course.id }))}
                    required
                  />
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
                  <div className="md:col-span-2">
                    <FormField label="Description" name="description" as="textarea" required />
                  </div>
                  <div className="md:col-span-2">
                    <FormField label="Instructions" name="instructions" as="textarea" />
                  </div>
                  <div className="md:col-span-2">
                    <FileUploadField
                      label="Assignment attachment"
                      name="attachmentUrl"
                      helperText="Upload a PDF, DOC, DOCX, TXT, CSV, or image."
                    />
                  </div>
                </ApiForm>
              </div>
            ) : null}
          </div>
        </Panel>
      )}

      <section className="space-y-6">
        {!assignments.length ? (
          <EmptyState title="No assignments yet" description="Assignments will appear here once they are created for your courses." />
        ) : (
          assignments.map((assignment) => (
            <Panel
              key={assignment.id}
              title={assignment.title}
              subtitle={assignment.description}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="purple">{assignment.course.title}</Badge>
                <Badge tone="slate">{assignment.submissionType}</Badge>
                <Badge tone={assignment.status === "PUBLISHED" ? "green" : "purple"}>{assignment.status}</Badge>
                <Badge tone="red">Due {formatShortDate(assignment.dueAt)}</Badge>
              </div>

              {session.role === "STUDENT" ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[22px] bg-[#faf7ff] p-4">
                    <p className="font-semibold text-slate-950">Instructions</p>
                    <p className="mt-2 text-sm text-slate-600">{assignment.instructions || "No extra instructions provided."}</p>
                    {assignment.attachmentUrl ? (
                      <div className="mt-4">
                        <FileDisplay url={assignment.attachmentUrl} title={assignment.title} />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!canStudentSubmitBeforeDueDate(assignment.dueAt ? new Date(assignment.dueAt) : null)) {
                          toast.error("The due date for this assignment has passed.");
                          return;
                        }

                        setActiveSubmissionAssignmentId((currentAssignmentId) =>
                          currentAssignmentId === assignment.id ? null : assignment.id,
                        );
                      }}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        activeSubmissionAssignmentId === assignment.id
                          ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                          : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                      }`}
                    >
                      {activeSubmissionAssignmentId === assignment.id
                        ? "Close Submission Form"
                        : assignment.submissions.length
                          ? "Update Submission"
                          : "Start Submission"}
                    </button>

                    {!canStudentSubmitBeforeDueDate(assignment.dueAt ? new Date(assignment.dueAt) : null) ? (
                      <p className="text-sm text-[#b42318]">This assignment is closed because the due date has passed.</p>
                    ) : null}

                    {activeSubmissionAssignmentId === assignment.id &&
                    canStudentSubmitBeforeDueDate(assignment.dueAt ? new Date(assignment.dueAt) : null) ? (
                      <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                        <ApiForm
                          action="/api/assignments/submit"
                          submitLabel={assignment.submissions.length ? "Update submission" : "Submit assignment"}
                          successMessage="Assignment submitted."
                          className="grid gap-3"
                          onSuccess={() => setActiveSubmissionAssignmentId(null)}
                        >
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <FileUploadField
                            label="Submission file"
                            name="fileUrl"
                            helperText="Upload your submission file or leave this empty if you are submitting by link or text."
                          />
                          <FormField label="Link URL" name="linkUrl" placeholder="https://..." />
                          <FormField label="Text submission" name="textSubmission" as="textarea" />
                        </ApiForm>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveEditAssignmentId((currentAssignmentId) =>
                          currentAssignmentId === assignment.id ? null : assignment.id,
                        )
                      }
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        activeEditAssignmentId === assignment.id
                          ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                          : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                      }`}
                    >
                      {activeEditAssignmentId === assignment.id ? "Close Assignment Editor" : "Edit Assignment"}
                    </button>
                    <Link
                      href={`/assignments/${assignment.id}`}
                      className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                    >
                      View Submissions
                    </Link>
                  </div>

                  {activeEditAssignmentId === assignment.id ? (
                    <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                      <ApiForm
                        action={`/api/assignments/${assignment.id}`}
                        method="PATCH"
                        submitLabel="Save assignment"
                        successMessage="Assignment updated."
                        className="grid gap-4 md:grid-cols-2"
                        resetOnSuccess={false}
                        onSuccess={() => setActiveEditAssignmentId(null)}
                      >
                        <FormField label="Title" name="title" defaultValue={assignment.title} required />
                        <FormField
                          label="Submission type"
                          name="submissionType"
                          as="select"
                          defaultValue={assignment.submissionType}
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
                          defaultValue={assignment.status}
                          options={[
                            { label: "Draft", value: "DRAFT" },
                            { label: "Published", value: "PUBLISHED" },
                          ]}
                        />
                        <FormField label="Due date" name="dueAt" type="datetime-local" defaultValue={toLmsDateTimeLocalValue(assignment.dueAt)} />
                        <div className="md:col-span-2">
                          <FormField label="Description" name="description" as="textarea" defaultValue={assignment.description} required />
                        </div>
                        <div className="md:col-span-2">
                          <FormField label="Instructions" name="instructions" as="textarea" defaultValue={assignment.instructions ?? ""} />
                        </div>
                        <div className="md:col-span-2">
                          <FileUploadField
                            label="Assignment attachment"
                            name="attachmentUrl"
                            defaultValue={assignment.attachmentUrl ?? ""}
                            helperText="Upload a PDF, DOC, DOCX, TXT, CSV, or image."
                          />
                        </div>
                      </ApiForm>
                    </div>
                  ) : null}

                  <div className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                    <p className="font-semibold text-slate-950">
                      {assignment.submissions.length} submission{assignment.submissions.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Open the submissions page to review student work, see submission times, grade, and give feedback.
                    </p>
                  </div>
                </div>
              )}
            </Panel>
          ))
        )}
      </section>
    </DashboardLayout>
  );
}
