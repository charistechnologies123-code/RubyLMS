import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { getVisibleQuizWhere } from "@/lib/lms";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type QuizAttemptView = {
  id: string;
  attemptNumber: number;
  score: number | null;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const quizzes = await prisma.quiz.findMany({
        where: getVisibleQuizWhere(session),
        include: {
          course: true,
          attempts:
            session.role === "STUDENT"
              ? { where: { studentId: session.userId }, orderBy: { attemptNumber: "desc" } }
              : {
                  orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
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
        orderBy: { createdAt: "desc" },
      });

    return {
      quizzes: serialize(quizzes),
    };
  });
}

export default function QuizzesPage({
  session,
  quizzes,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const studentQuizzes = quizzes as Array<
    (typeof quizzes)[number] & {
      attempts: QuizAttemptView[];
    }
  >;
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Quizzes"
      description={session.role === "STUDENT" ? "Open available quizzes and review your attempt history." : "Review quizzes and submitted attempt scores across the LMS."}
    >
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
                      Open quiz
                    </Link>
                    {!quiz.attempts.length ? (
                      <p className="text-sm text-slate-600">No attempts recorded yet.</p>
                    ) : (
                      quiz.attempts.map((attempt) => (
                        <div key={attempt.id} className="rounded-[22px] border border-[#eee4ff] bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="slate">Attempt {attempt.attemptNumber}</Badge>
                            <Badge tone={attempt.isSubmitted ? "green" : "purple"}>
                              {attempt.isSubmitted ? "Submitted" : "In progress"}
                            </Badge>
                            <Badge tone="purple">
                              {typeof attempt.score === "number" ? `${attempt.score} points` : "Awaiting score"}
                            </Badge>
                          </div>
                          {"student" in attempt ? (
                            <p className="mt-3 text-sm text-slate-700">
                              {attempt.student.fullName}
                              {attempt.student.studentId ? ` (${attempt.student.studentId})` : ""}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
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
