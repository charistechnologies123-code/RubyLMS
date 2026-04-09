import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import QuizBuilderField from "@/components/ui/QuizBuilderField";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type QuizOption = {
  id: string;
  optionText: string;
  isCorrect: boolean;
};

type QuizQuestionView = {
  id: string;
  questionBank: {
    questionText: string;
    options: QuizOption[];
  };
};

type QuizAttemptView = {
  id: string;
  attemptNumber: number;
  score: number | null;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const [courses, quizzes] = await Promise.all([
      prisma.course.findMany({
        where:
          session.role === "STUDENT"
            ? { enrollments: { some: { studentId: session.userId } } }
            : session.role === "INSTRUCTOR"
              ? { OR: [{ instructorId: session.userId }, { createdById: session.userId }] }
              : {},
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      prisma.quiz.findMany({
        where:
          session.role === "STUDENT"
            ? { course: { enrollments: { some: { studentId: session.userId } } } }
            : session.role === "INSTRUCTOR"
              ? { course: { OR: [{ instructorId: session.userId }, { createdById: session.userId }] } }
              : {},
        include: {
          course: true,
          quizQuestions: {
            orderBy: { order: "asc" },
            include: {
              questionBank: {
                include: {
                  options: { orderBy: { order: "asc" } },
                },
              },
            },
          },
          attempts:
            session.role === "STUDENT"
              ? { where: { studentId: session.userId }, orderBy: { attemptNumber: "desc" } }
              : false,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      courses: serialize(courses),
      quizzes: serialize(quizzes),
    };
  });
}

export default function QuizzesPage({
  session,
  courses,
  quizzes,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const canManage = session.role !== "STUDENT";
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const studentQuizzes = quizzes as Array<
    (typeof quizzes)[number] & {
      quizQuestions: QuizQuestionView[];
      attempts: QuizAttemptView[];
    }
  >;
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Quizzes"
      description="Manage timed assessments with configurable attempts and student submission tracking."
    >
      {canManage && (
        <Panel
          title="Quiz Builder"
          subtitle="Open the builder only when you are ready to create a quiz."
          className="mb-6"
        >
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowCreateQuiz((current) => !current)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                showCreateQuiz
                  ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                  : "border border-[#e8ddff] bg-white text-[#6b00ff]"
              }`}
            >
              {showCreateQuiz ? "Close Quiz Builder" : "Create Quiz"}
            </button>

            {showCreateQuiz ? (
              <div className="rounded-[24px] border border-[#e8ddff] bg-[#fcfaff] p-5">
                <ApiForm
                  action="/api/quizzes"
                  submitLabel="Create quiz"
                  successMessage="Quiz created."
                  className="grid gap-4 md:grid-cols-2"
                  onSuccess={() => setShowCreateQuiz(false)}
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
                    label="Time limit (minutes)"
                    name="timeLimitMinutes"
                    type="number"
                    defaultValue="20"
                    required
                  />
                  <FormField label="Max attempts" name="maxAttempts" type="number" defaultValue="1" />
                  <div className="md:col-span-2">
                    <FormField label="Description" name="description" as="textarea" />
                  </div>
                  <div className="md:col-span-2">
                    <FormField label="Instructions" name="instructions" as="textarea" />
                  </div>
                  <QuizBuilderField />
                </ApiForm>
              </div>
            ) : null}
          </div>
        </Panel>
      )}

      {!quizzes.length ? (
        <EmptyState
          title="No quizzes yet"
          description="Create a quiz or wait for one to be assigned to your course."
        />
      ) : (
        <div className="space-y-6">
          {quizzes.map((quiz) => {
            const studentQuiz = studentQuizzes.find((currentQuiz) => currentQuiz.id === quiz.id);

            return (
              <Panel
                key={quiz.id}
                title={quiz.title}
                subtitle={quiz.description || "Timed quiz assessment"}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{quiz.course.title}</Badge>
                  <Badge tone="slate">{quiz.timeLimitMinutes} min</Badge>
                  <Badge tone="slate">{quiz.maxAttempts} attempt(s)</Badge>
                  <Badge tone={quiz.status === "PUBLISHED" ? "green" : "purple"}>{quiz.status}</Badge>
                </div>

                {session.role === "STUDENT" && studentQuiz ? (
                  <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[24px] border border-[#efe6ff] bg-[#fcfaff] p-5">
                      <p className="font-semibold text-slate-950">Take Quiz</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Open the quiz in its own workspace to see the timer, move between questions, and track progress.
                      </p>
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="mt-4 inline-flex rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white"
                      >
                        Open quiz
                      </Link>
                    </div>
                    <div className="rounded-[24px] bg-[#fff8f8] p-4">
                      <p className="font-semibold text-slate-950">Attempt history</p>
                      <div className="mt-3 space-y-3">
                        {studentQuiz.attempts.length ? (
                          studentQuiz.attempts.map((attempt) => (
                            <div key={attempt.id} className="rounded-[20px] bg-white p-3">
                              <p className="text-sm font-semibold text-slate-950">
                                Attempt {attempt.attemptNumber}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {typeof attempt.score === "number"
                                  ? `${attempt.score} points`
                                  : "Awaiting score"}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">No attempts recorded yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="inline-flex rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
                    >
                      Open quiz workspace
                    </Link>
                    {quiz.quizQuestions.map((question, index) => (
                      <div
                        key={question.id}
                        className="rounded-[22px] border border-[#eee4ff] bg-white p-4"
                      >
                        <p className="font-semibold text-slate-950">
                          {index + 1}. {question.questionBank.questionText}
                        </p>
                        <div className="mt-3 grid gap-2">
                          {question.questionBank.options.map((option) => (
                            <div
                              key={option.id}
                              className="rounded-2xl bg-[#faf7ff] px-4 py-3 text-sm text-slate-700"
                            >
                              {option.optionText} {option.isCorrect ? " - Correct" : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
