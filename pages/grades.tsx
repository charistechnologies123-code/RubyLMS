import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { calculateGradebookTotals } from "@/lib/gradebookSummary";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["STUDENT"], async (session) => {
    const publications = await prisma.gradebookPublication.findMany({
      where: {
        publishedAt: {
          not: null,
        },
        course: {
          enrollments: {
            some: {
              studentId: session.userId,
            },
          },
        },
      },
      include: {
        course: {
          include: {
            gradebookColumns: {
              include: {
                cells: {
                  where: {
                    studentId: session.userId,
                  },
                },
              },
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return {
      publications: serialize(publications),
    };
  });
}

export default function GradesPage({
  session,
  publications,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <DashboardLayout
      role="STUDENT"
      session={session}
      title="Grades"
      description="Published course gradebooks appear here with your scores, totals, and average."
    >
      {!publications.length ? (
        <EmptyState title="No published grades yet" description="Your instructors will publish course gradebooks here when they are ready." />
      ) : (
        <div className="space-y-6">
          {publications.map((publication) => {
            const columns = publication.course.gradebookColumns;
            const cells = columns
              .map((column) => column.cells[0])
              .filter(Boolean);
            const totals = calculateGradebookTotals(columns, cells);

            return (
              <Panel
                key={publication.id}
                title={publication.course.title}
                subtitle={`Average ${totals.averagePercent.toFixed(2)}%`}
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge tone="green">Published</Badge>
                  <Badge tone="slate">
                    Total {totals.totalScore.toFixed(2).replace(/\.00$/, "")}
                    {totals.totalPossible > 0 ? ` / ${totals.totalPossible.toFixed(2).replace(/\.00$/, "")}` : ""}
                  </Badge>
                  <Badge tone="purple">Average {totals.averagePercent.toFixed(2)}%</Badge>
                </div>

                <div className="overflow-x-auto rounded-[24px] border border-[#e8ddff] bg-white">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-[#faf7ff]">
                      <tr>
                        <th className="border-b border-[#eee4ff] px-4 py-3 text-left font-semibold text-slate-900">Column</th>
                        <th className="border-b border-[#eee4ff] px-4 py-3 text-left font-semibold text-slate-900">Type</th>
                        <th className="border-b border-[#eee4ff] px-4 py-3 text-left font-semibold text-slate-900">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((column) => (
                        <tr key={column.id} className="border-b border-[#f4edff] last:border-b-0">
                          <td className="px-4 py-3 font-semibold text-slate-900">{column.title}</td>
                          <td className="px-4 py-3 text-slate-600">{column.type}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {typeof column.cells[0]?.score === "number" ? column.cells[0]?.score : "-"}
                            {typeof column.maxScore === "number" ? ` / ${column.maxScore}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

