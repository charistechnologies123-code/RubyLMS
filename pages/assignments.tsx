import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { formatShortDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const [courses, assignments] = await Promise.all([
      prisma.course.findMany({
        where:
          session.role === "STUDENT"
            ? {
                enrollments: { some: { studentId: session.userId } },
              }
            : session.role === "INSTRUCTOR"
              ? {
                  OR: [{ instructorId: session.userId }, { createdById: session.userId }],
                }
              : {},
        select: {
          id: true,
          title: true,
        },
        orderBy: { title: "asc" },
      }),
      prisma.assignment.findMany({
        where:
          session.role === "STUDENT"
            ? {
                course: {
                  enrollments: { some: { studentId: session.userId } },
                },
              }
            : session.role === "INSTRUCTOR"
              ? {
                  course: {
                    OR: [{ instructorId: session.userId }, { createdById: session.userId }],
                  },
                }
              : {},
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
  const managedAssignments = assignments as Array<
    (typeof assignments)[number] & {
      submissions: Array<{
        id: string;
        score: number | null;
        feedback: string | null;
        textSubmission: string | null;
        linkUrl: string | null;
        fileUrl: string | null;
        student: {
          fullName: string;
          studentId: string | null;
        };
      }>;
    }
  >;

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
                  <FormField label="Due date" name="dueAt" type="datetime-local" />
                  <div className="md:col-span-2">
                    <FormField label="Description" name="description" as="textarea" required />
                  </div>
                  <div className="md:col-span-2">
                    <FormField label="Instructions" name="instructions" as="textarea" />
                  </div>
                  <div className="md:col-span-2">
                    <FormField label="Attachment URL" name="attachmentUrl" placeholder="https://..." />
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
                <Badge tone="red">Due {formatShortDate(assignment.dueAt)}</Badge>
              </div>

              {session.role === "STUDENT" ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[22px] bg-[#faf7ff] p-4">
                    <p className="font-semibold text-slate-950">Instructions</p>
                    <p className="mt-2 text-sm text-slate-600">{assignment.instructions || "No extra instructions provided."}</p>
                  </div>
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSubmissionAssignmentId((currentAssignmentId) =>
                          currentAssignmentId === assignment.id ? null : assignment.id,
                        )
                      }
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

                    {activeSubmissionAssignmentId === assignment.id ? (
                      <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                        <ApiForm
                          action="/api/assignments/submit"
                          submitLabel={assignment.submissions.length ? "Update submission" : "Submit assignment"}
                          successMessage="Assignment submitted."
                          className="grid gap-3"
                          onSuccess={() => setActiveSubmissionAssignmentId(null)}
                        >
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <FormField label="File URL" name="fileUrl" placeholder="https://..." />
                          <FormField label="Link URL" name="linkUrl" placeholder="https://..." />
                          <FormField label="Text submission" name="textSubmission" as="textarea" />
                        </ApiForm>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {!assignment.submissions.length ? (
                    <EmptyState title="No submissions yet" description="Submissions will appear here after students respond." />
                  ) : (
                    managedAssignments
                      .find((currentAssignment) => currentAssignment.id === assignment.id)!
                      .submissions.map((submission) => {
                        const gradedSubmission = submission as typeof submission & {
                          student: {
                            fullName: string;
                            studentId: string | null;
                          };
                        };

                        return (
                      <div key={submission.id} className="rounded-[22px] border border-[#efe6ff] bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">{gradedSubmission.student.fullName}</p>
                            <p className="text-sm text-slate-600">{gradedSubmission.student.studentId ?? "No ID"}</p>
                            <p className="mt-2 text-sm text-slate-600">
                              {submission.textSubmission || submission.linkUrl || submission.fileUrl || "Submission recorded"}
                            </p>
                          </div>
                          <div className="min-w-[280px]">
                            <ApiForm
                              action="/api/assignments/grade"
                              submitLabel="Save grade"
                              successMessage="Grade saved."
                              className="grid gap-3"
                            >
                              <input type="hidden" name="submissionId" value={submission.id} />
                              <FormField label="Score" name="score" type="number" defaultValue={submission.score ?? ""} />
                              <FormField label="Feedback" name="feedback" as="textarea" defaultValue={submission.feedback ?? ""} />
                            </ApiForm>
                          </div>
                        </div>
                      </div>
                        );
                      })
                  )}
                </div>
              )}
            </Panel>
          ))
        )}
      </section>
    </DashboardLayout>
  );
}
