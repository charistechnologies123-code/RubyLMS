import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import QuizBuilderField from "@/components/ui/QuizBuilderField";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type BuilderQuestion = {
  id: string;
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  marks: string;
  explanation: string;
  options: Array<{
    optionText: string;
    isCorrect: boolean;
  }>;
};

type QuizQuestionOption = {
  id: string;
  optionText: string;
};

type QuizQuestionData = {
  id: string;
  order: number;
  questionBank: {
    questionText: string;
    explanation: string | null;
    options: QuizQuestionOption[];
  };
};

type QuizAttemptData = {
  id: string;
  attemptNumber: number;
  expiresAt: string;
  isSubmitted: boolean;
};

type QuizPageProps = {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  canManage: boolean;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    status: string;
    timeLimitMinutes: number;
    maxAttempts: number;
    courseId: string;
    lessonId: string | null;
    course: {
      id: string;
      title: string;
    };
    lesson: {
      id: string;
      title: string;
    } | null;
    quizQuestions: QuizQuestionData[];
  };
  initialQuestions: BuilderQuestion[];
  activeAttempt: QuizAttemptData | null;
  pastAttempts: Array<{
    id: string;
    attemptNumber: number;
    score: number | null;
    isSubmitted: boolean;
  }>;
};

export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<QuizPageProps>> {
  const session = getSessionFromPageContext(ctx);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  if (!assertRoleAccess(session, ["ADMIN", "INSTRUCTOR", "STUDENT"])) {
    return { redirect: { destination: getDefaultRouteForRole(session.role), permanent: false } };
  }

  const quizId = String(ctx.params?.quizId);

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      ...(session.role === "STUDENT"
        ? { course: { enrollments: { some: { studentId: session.userId } } } }
        : session.role === "INSTRUCTOR"
          ? { course: { OR: [{ instructorId: session.userId }, { createdById: session.userId }] } }
          : {}),
    },
    include: {
      course: {
        select: { id: true, title: true, instructorId: true },
      },
      lesson: {
        select: { id: true, title: true },
      },
      quizQuestions: {
        orderBy: { order: "asc" },
        include: {
          questionBank: {
            include: {
              options: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  optionText: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },
      attempts:
        session.role === "STUDENT"
          ? {
              where: { studentId: session.userId },
              orderBy: { attemptNumber: "desc" },
            }
          : false,
    },
  });

  if (!quiz) {
    return { redirect: { destination: "/quizzes", permanent: false } };
  }

  const canManage = canManageCourse(session, quiz.course.instructorId);
  let activeAttempt: QuizAttemptData | null = null;
  let pastAttempts: QuizPageProps["pastAttempts"] = [];

  if (session.role === "STUDENT") {
    const attempts = (quiz.attempts as Array<{
      id: string;
      attemptNumber: number;
      expiresAt: Date;
      isSubmitted: boolean;
      score: number | null;
    }>) ?? [];

    pastAttempts = attempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      isSubmitted: attempt.isSubmitted,
    }));

    const unfinishedAttempt = attempts.find((attempt) => !attempt.isSubmitted && attempt.expiresAt > new Date());

    if (unfinishedAttempt) {
      activeAttempt = {
        id: unfinishedAttempt.id,
        attemptNumber: unfinishedAttempt.attemptNumber,
        expiresAt: unfinishedAttempt.expiresAt.toISOString(),
        isSubmitted: unfinishedAttempt.isSubmitted,
      };
    } else if (attempts.filter((attempt) => attempt.isSubmitted).length < quiz.maxAttempts) {
      const createdAttempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: session.userId,
          attemptNumber: attempts.length + 1,
          expiresAt: new Date(Date.now() + quiz.timeLimitMinutes * 60 * 1000),
        },
      });

      activeAttempt = {
        id: createdAttempt.id,
        attemptNumber: createdAttempt.attemptNumber,
        expiresAt: createdAttempt.expiresAt.toISOString(),
        isSubmitted: createdAttempt.isSubmitted,
      };
    }
  }

  const initialQuestions: BuilderQuestion[] = quiz.quizQuestions.map((question) => ({
    id: question.id,
    questionText: question.questionBank.questionText,
    questionType: question.questionBank.questionType,
    marks: String(question.marksOverride ?? question.questionBank.marks ?? 1),
    explanation: question.questionBank.explanation ?? "",
    options: question.questionBank.options.map((option) => ({
      optionText: option.optionText,
      isCorrect: option.isCorrect,
    })),
  }));

  return {
    props: {
      session,
      canManage,
      quiz: serialize({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        instructions: quiz.instructions,
        status: quiz.status,
        timeLimitMinutes: quiz.timeLimitMinutes,
        maxAttempts: quiz.maxAttempts,
        courseId: quiz.courseId,
        lessonId: quiz.lessonId,
        course: {
          id: quiz.course.id,
          title: quiz.course.title,
        },
        lesson: quiz.lesson,
        quizQuestions: quiz.quizQuestions.map((question) => ({
          id: question.id,
          order: question.order,
          questionBank: {
            questionText: question.questionBank.questionText,
            explanation: question.questionBank.explanation,
            options: question.questionBank.options.map((option) => ({
              id: option.id,
              optionText: option.optionText,
            })),
          },
        })),
      }),
      initialQuestions,
      activeAttempt,
      pastAttempts,
    },
  };
}

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function QuizAttemptWorkspace({
  quiz,
  activeAttempt,
  pastAttempts,
}: {
  quiz: QuizPageProps["quiz"];
  activeAttempt: QuizAttemptData;
  pastAttempts: QuizPageProps["pastAttempts"];
}) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);
  const submitQuiz = useCallback(async () => {
    setSubmitting(true);

    const response = await fetch("/api/quizzes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId: quiz.id,
        attemptId: activeAttempt.id,
        answers: Object.entries(answers).map(([quizQuestionId, selectedOptionId]) => ({
          quizQuestionId,
          selectedOptionId,
        })),
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "Quiz submission failed.");
      setSubmitting(false);
      return;
    }

    toast.success(
      typeof result.score === "number"
        ? `Quiz submitted. Score: ${result.score}`
        : "Quiz submitted successfully.",
    );
    router.replace(router.asPath);
  }, [activeAttempt.id, answers, quiz.id, router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            void submitQuiz();
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [submitQuiz]);

  const currentQuestion = quiz.quizQuestions[currentQuestionIndex];
  const answeredCount = useMemo(
    () => quiz.quizQuestions.filter((question) => answers[question.id]).length,
    [answers, quiz.quizQuestions],
  );

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="purple">Attempt {activeAttempt.attemptNumber}</Badge>
            <Badge tone="slate">{answeredCount}/{quiz.quizQuestions.length} answered</Badge>
          </div>
          <div className="rounded-2xl bg-[#fff4f4] px-4 py-3 text-sm font-semibold text-[#b42318]">
            Time left: {formatRemaining(remainingSeconds)}
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Panel title="Question Navigation" subtitle="Jump between questions and track progress.">
          <div className="grid grid-cols-4 gap-2">
            {quiz.quizQuestions.map((question, index) => {
              const isAnswered = Boolean(answers[question.id]);
              const isActive = index === currentQuestionIndex;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : isAnswered
                        ? "border border-[#d6f5df] bg-[#effcf3] text-[#067647]"
                        : "border border-[#e8ddff] bg-white text-slate-700"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title={`Question ${currentQuestionIndex + 1}`} subtitle={`${answeredCount} of ${quiz.quizQuestions.length} answered`}>
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-slate-950">{currentQuestion.questionBank.questionText}</p>
              {currentQuestion.questionBank.explanation ? (
                <p className="mt-2 text-sm text-slate-600">{currentQuestion.questionBank.explanation}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              {currentQuestion.questionBank.options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#eee4ff] bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={option.id}
                    checked={answers[currentQuestion.id] === option.id}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [currentQuestion.id]: option.id,
                      }))
                    }
                  />
                  {option.optionText}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                disabled={currentQuestionIndex === 0}
                className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((current) => Math.min(quiz.quizQuestions.length - 1, current + 1))}
                disabled={currentQuestionIndex === quiz.quizQuestions.length - 1}
                className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => void submitQuiz()}
                disabled={submitting}
                className="rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Quiz"}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Attempt History">
        <div className="space-y-3">
          {pastAttempts.length ? (
            pastAttempts.map((attempt) => (
              <div key={attempt.id} className="rounded-[20px] border border-[#efe6ff] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">Attempt {attempt.attemptNumber}</Badge>
                  <Badge tone={attempt.isSubmitted ? "green" : "slate"}>
                    {attempt.isSubmitted ? "Submitted" : "In progress"}
                  </Badge>
                  <Badge tone="slate">
                    {typeof attempt.score === "number" ? `${attempt.score} points` : "Awaiting score"}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No attempts recorded yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

export default function QuizDetailPage({
  session,
  canManage,
  quiz,
  initialQuestions,
  activeAttempt,
  pastAttempts,
}: QuizPageProps) {
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={quiz.title}
      description={quiz.description || `Quiz inside ${quiz.course.title}.`}
    >
      <Panel className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">{quiz.course.title}</Badge>
              {quiz.lesson ? <Badge tone="slate">{quiz.lesson.title}</Badge> : null}
              <Badge tone="slate">{quiz.timeLimitMinutes} min</Badge>
              <Badge tone="slate">{quiz.maxAttempts} attempts</Badge>
              <Badge tone={quiz.status === "PUBLISHED" ? "green" : "purple"}>{quiz.status}</Badge>
            </div>
            {quiz.instructions ? <p className="text-sm leading-7 text-slate-700">{quiz.instructions}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/quizzes" className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              Back to quizzes
            </Link>
            {quiz.lesson ? (
              <Link href={`/courses/${quiz.courseId}/lessons/${quiz.lesson.id}`} className="rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]">
                Back to module
              </Link>
            ) : (
              <Link href={`/courses/${quiz.courseId}`} className="rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]">
                Back to course
              </Link>
            )}
          </div>
        </div>
      </Panel>

      {canManage ? (
        <Panel title="Edit Quiz" subtitle="Update the quiz settings and question set from one place.">
          <ApiForm
            action={`/api/quizzes/${quiz.id}`}
            method="PATCH"
            submitLabel="Save quiz"
            successMessage="Quiz updated."
            resetOnSuccess={false}
            className="grid gap-4 md:grid-cols-2"
          >
            <FormField label="Title" name="title" defaultValue={quiz.title} required />
            <FormField label="Time limit (minutes)" name="timeLimitMinutes" type="number" defaultValue={quiz.timeLimitMinutes} required />
            <FormField label="Max attempts" name="maxAttempts" type="number" defaultValue={quiz.maxAttempts} />
            <div className="md:col-span-2">
              <FormField label="Description" name="description" as="textarea" defaultValue={quiz.description ?? ""} />
            </div>
            <div className="md:col-span-2">
              <FormField label="Instructions" name="instructions" as="textarea" defaultValue={quiz.instructions ?? ""} />
            </div>
            <QuizBuilderField initialQuestions={initialQuestions} />
          </ApiForm>
        </Panel>
      ) : activeAttempt ? (
        <QuizAttemptWorkspace quiz={quiz} activeAttempt={activeAttempt} pastAttempts={pastAttempts} />
      ) : (
        <Panel title="Quiz Attempts">
          <p className="text-sm text-slate-600">No attempt is available right now. You may have reached the maximum number of attempts.</p>
        </Panel>
      )}
    </DashboardLayout>
  );
}
