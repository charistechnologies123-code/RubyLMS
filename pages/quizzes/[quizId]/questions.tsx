import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import Badge from "@/components/ui/Badge";
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

type QuizQuestionEditorProps = {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    status: string;
    timeLimitMinutes: number;
    maxAttempts: number;
    dueAt: string | null;
    courseId: string;
    lessonId: string | null;
    managerIds: string[];
  };
  initialQuestions: BuilderQuestion[];
};

export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<QuizQuestionEditorProps>> {
  const session = getSessionFromPageContext(ctx);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  if (!assertRoleAccess(session, ["ADMIN", "INSTRUCTOR"])) {
    return { redirect: { destination: getDefaultRouteForRole(session.role), permanent: false } };
  }

  const quizId = String(ctx.params?.quizId);

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: {
        include: {
          courseManagers: true,
        },
      },
      quizQuestions: {
        orderBy: { order: "asc" },
        include: {
          questionBank: {
            include: {
              options: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return { redirect: { destination: "/quizzes", permanent: false } };
  }

  const managerIds = [quiz.course.instructorId, quiz.course.createdById, ...quiz.course.courseManagers.map((manager) => manager.userId)].filter(Boolean) as string[];

  if (!canManageCourse(session, managerIds)) {
    return { redirect: { destination: "/quizzes", permanent: false } };
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
      quiz: serialize({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        instructions: quiz.instructions,
        status: quiz.status,
        timeLimitMinutes: quiz.timeLimitMinutes,
        maxAttempts: quiz.maxAttempts,
        dueAt: quiz.dueAt?.toISOString() ?? null,
        courseId: quiz.courseId,
        lessonId: quiz.lessonId,
        managerIds,
      }),
      initialQuestions,
    },
  };
}

export default function QuizQuestionEditorPage({
  session,
  quiz,
  initialQuestions,
}: QuizQuestionEditorProps) {
  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title={`Edit Questions: ${quiz.title}`}
      description="Question editing is separated from quiz settings so updates stay predictable."
    >
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="purple">{quiz.title}</Badge>
          <Badge tone={quiz.status === "PUBLISHED" ? "green" : "purple"}>{quiz.status}</Badge>
          <Badge tone="slate">{initialQuestions.length} question(s)</Badge>
        </div>
      </Panel>

      <Panel title="Question Editor" subtitle="Add, reorder, and update quiz questions here.">
        <ApiForm
          action={`/api/quizzes/${quiz.id}`}
          method="PATCH"
          submitLabel="Save questions"
          successMessage="Quiz questions updated."
          resetOnSuccess={false}
          className="grid gap-4"
        >
          <input type="hidden" name="title" value={quiz.title} />
          <input type="hidden" name="timeLimitMinutes" value={quiz.timeLimitMinutes} />
          <input type="hidden" name="maxAttempts" value={quiz.maxAttempts} />
          <input type="hidden" name="status" value={quiz.status} />
          <input type="hidden" name="description" value={quiz.description ?? ""} />
          <input type="hidden" name="instructions" value={quiz.instructions ?? ""} />
          <input type="hidden" name="dueAt" value={quiz.dueAt ?? ""} />
          <QuizBuilderField initialQuestions={initialQuestions} />
        </ApiForm>

        <div className="mt-4">
          <Link
            href={`/quizzes/${quiz.id}`}
            className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Back to quiz settings
          </Link>
        </div>
      </Panel>
    </DashboardLayout>
  );
}
