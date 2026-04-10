"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";

type GradebookStudent = {
  id: string;
  fullName: string;
  studentId: string | null;
};

type GradebookColumnView = {
  id: string;
  title: string;
  type: "QUIZ" | "ASSIGNMENT" | "ATTENDANCE" | "CUSTOM";
  maxScore: number | null;
  includeInTotals: boolean;
  scorePath: string | null;
  editable: boolean;
  cells: Array<{
    studentId: string;
    score: number | null;
  }>;
};

type GradebookSpreadsheetProps = {
  courseId: string;
  students: GradebookStudent[];
  columns: GradebookColumnView[];
};

function formatScore(score: number | null) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "";
  }

  return `${score}`;
}

export default function GradebookSpreadsheet({
  courseId,
  students,
  columns,
}: GradebookSpreadsheetProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initialValues: Record<string, string> = {};

    for (const column of columns) {
      if (!column.editable) {
        continue;
      }

      for (const cell of column.cells) {
        initialValues[`${column.id}:${cell.studentId}`] = formatScore(cell.score);
      }
    }

    return initialValues;
  });

  function getRawValue(columnId: string, studentId: string) {
    return values[`${columnId}:${studentId}`] ?? "";
  }

  function getDisplayScore(column: GradebookColumnView, studentId: string) {
    if (column.editable) {
      const rawValue = getRawValue(column.id, studentId);
      return rawValue.length ? Number(rawValue) : null;
    }

    return column.cells.find((cell) => cell.studentId === studentId)?.score ?? null;
  }

  async function saveGrades() {
    setSaving(true);

    const updates = columns
      .filter((column) => column.editable)
      .flatMap((column) =>
        students.map((student) => {
          const rawValue = getRawValue(column.id, student.id).trim();

          return {
            columnId: column.id,
            studentId: student.id,
            score: rawValue.length ? Number(rawValue) : null,
          };
        }),
      );

    const response = await fetch(`/api/gradebook/courses/${courseId}/cells`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ updates }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "Unable to save gradebook changes.");
      setSaving(false);
      return;
    }

    toast.success("Gradebook saved.");
    setSaving(false);
    router.replace(router.asPath);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void saveGrades()}
          disabled={saving}
          className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8e42ff)] px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save gradebook"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-[#e8ddff] bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[#faf7ff]">
            <tr>
              <th className="sticky left-0 z-10 border-b border-[#eee4ff] bg-[#faf7ff] px-4 py-3 text-left font-semibold text-slate-900">
                Student
              </th>
              {columns.map((column) => (
                <th key={column.id} className="border-b border-[#eee4ff] px-4 py-3 text-left font-semibold text-slate-900">
                  <div className="space-y-1">
                    {column.scorePath ? (
                      <Link href={column.scorePath} className="text-[#6b00ff] underline decoration-[#d9c2ff] underline-offset-4">
                        {column.title}
                      </Link>
                    ) : (
                      <span>{column.title}</span>
                    )}
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      {column.type}
                      {typeof column.maxScore === "number" ? ` • / ${column.maxScore}` : ""}
                    </p>
                  </div>
                </th>
              ))}
              <th className="border-b border-[#eee4ff] px-4 py-3 text-left font-semibold text-slate-900">Total</th>
              <th className="border-b border-[#eee4ff] px-4 py-3 text-left font-semibold text-slate-900">Average</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              let total = 0;
              let possible = 0;

              for (const column of columns) {
                if (!column.includeInTotals) {
                  continue;
                }

                const score = getDisplayScore(column, student.id);

                if (typeof score === "number" && !Number.isNaN(score)) {
                  total += score;
                }

                if (typeof column.maxScore === "number" && column.maxScore > 0) {
                  possible += column.maxScore;
                }
              }

              const average = possible > 0 ? (total / possible) * 100 : 0;

              return (
                <tr key={student.id} className="border-b border-[#f4edff] last:border-b-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{student.fullName}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{student.studentId ?? "No ID"}</p>
                    </div>
                  </td>
                  {columns.map((column) => {
                    const key = `${column.id}:${student.id}`;
                    const readOnlyScore = column.cells.find((cell) => cell.studentId === student.id)?.score ?? null;

                    return (
                      <td key={column.id} className="px-4 py-3 align-top">
                        {column.editable ? (
                          <input
                            type="number"
                            step="0.01"
                            value={values[key] ?? ""}
                            onChange={(event) =>
                              setValues((currentValues) => ({
                                ...currentValues,
                                [key]: event.target.value,
                              }))
                            }
                            className="w-24 rounded-2xl border border-[#e8ddff] bg-[#fcfaff] px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                          />
                        ) : (
                          <div className="rounded-2xl bg-[#faf7ff] px-3 py-2 text-sm text-slate-700">
                            {typeof readOnlyScore === "number" ? readOnlyScore.toFixed(2).replace(/\.00$/, "") : "—"}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 align-top font-semibold text-slate-900">
                    {possible > 0 ? `${total.toFixed(2).replace(/\.00$/, "")} / ${possible.toFixed(2).replace(/\.00$/, "")}` : total.toFixed(2).replace(/\.00$/, "")}
                  </td>
                  <td className="px-4 py-3 align-top font-semibold text-[#6b00ff]">{average.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
