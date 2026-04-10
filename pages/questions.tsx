import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { getManagedCourseWhere } from "@/lib/courseManagers";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const [courses, questions] = await Promise.all([
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
      prisma.courseQuestion.findMany({
        where:
          session.role === "STUDENT"
            ? { course: { status: "PUBLISHED", enrollments: { some: { studentId: session.userId } } } }
            : session.role === "INSTRUCTOR"
              ? { course: getManagedCourseWhere(session) }
              : {},
        include: {
          course: true,
          askedBy: { select: { fullName: true, role: true } },
          answers: {
            include: {
              answeredBy: { select: { fullName: true, role: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      courses: serialize(courses),
      questions: serialize(questions),
    };
  });
}

export default function QuestionsPage({
  session,
  courses,
  questions,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [activeReplyQuestionId, setActiveReplyQuestionId] = useState<string | null>(null);

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Course Q&A"
      description="Support learning conversations with course-linked questions and instructor/admin responses."
    >
      {session.role === "STUDENT" ? (
        <Panel title="Question Builder" className="mb-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowQuestionForm((current) => !current)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                showQuestionForm
                  ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                  : "border border-[#e8ddff] bg-white text-[#6b00ff]"
              }`}
            >
              {showQuestionForm ? "Close Question Form" : "Ask a Question"}
            </button>

            {showQuestionForm ? (
              <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                <ApiForm
                  action="/api/questions"
                  submitLabel="Ask question"
                  successMessage="Question posted."
                  className="grid gap-4 md:grid-cols-2"
                  onSuccess={() => setShowQuestionForm(false)}
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
                    <FormField label="Question details" name="content" as="textarea" rows={6} required />
                  </div>
                </ApiForm>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="Questions Feed">
        {!questions.length ? (
          <EmptyState title="No questions yet" description="Questions from enrolled courses will appear here." />
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <article key={question.id} className="rounded-[24px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{question.course.title}</Badge>
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
                  {question.answers.map((answer) => (
                    <div key={answer.id} className="rounded-[20px] bg-[#faf7ff] p-4">
                      <p className="text-sm text-slate-700">{answer.content}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {answer.answeredBy.fullName} • {answer.answeredBy.role}
                      </p>
                    </div>
                  ))}
                </div>

                {session.role !== "STUDENT" ? (
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
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}
