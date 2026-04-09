"use client";

import type { ChangeEvent } from "react";
import { useId, useMemo, useState } from "react";
import toast from "react-hot-toast";

type QuizOptionForm = {
  optionText: string;
  isCorrect: boolean;
};

type QuizQuestionForm = {
  id: string;
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  marks: string;
  explanation: string;
  options: QuizOptionForm[];
};

type QuizBuilderFieldProps = {
  name?: string;
  label?: string;
  initialQuestions?: QuizQuestionForm[];
};

const SAMPLE_CSV = `questionText,questionType,marks,explanation,option1Text,option1Correct,option2Text,option2Correct,option3Text,option3Correct,option4Text,option4Correct
"Which action best reflects a learner-centered mindset?","SINGLE_CHOICE",1,"Focus on understanding learner problems first","Understand the learner problem before proposing a solution",true,"Skip feedback cycles to save time",false,"Ship features without testing",false,"Ignore course outcomes",false`;

export default function QuizBuilderField({
  name = "questions",
  label = "Quiz questions",
  initialQuestions,
}: QuizBuilderFieldProps) {
  const inputId = useId();
  const [questions, setQuestions] = useState<QuizQuestionForm[]>(
    initialQuestions?.length ? initialQuestions : [createQuestion()],
  );

  const serializedQuestions = useMemo(
    () =>
      JSON.stringify(
        questions.map((question) => ({
          questionText: question.questionText,
          questionType: question.questionType,
          marks: Number(question.marks || 1),
          explanation: question.explanation,
          options: question.options
            .filter((option) => option.optionText.trim())
            .map((option) => ({
              optionText: option.optionText,
              isCorrect: option.isCorrect,
            })),
        })),
      ),
    [questions],
  );

  function updateQuestion(questionId: string, updates: Partial<QuizQuestionForm>) {
    setQuestions((current) =>
      current.map((question) => (question.id === questionId ? { ...question, ...updates } : question)),
    );
  }

  function updateOption(questionId: string, optionIndex: number, updates: Partial<QuizOptionForm>) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextOptions = question.options.map((option, index) =>
          index === optionIndex ? { ...option, ...updates } : option,
        );

        return { ...question, options: nextOptions };
      }),
    );
  }

  function addQuestion() {
    setQuestions((current) => [...current, createQuestion()]);
  }

  function removeQuestion(questionId: string) {
    setQuestions((current) => (current.length === 1 ? current : current.filter((question) => question.id !== questionId)));
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quiz-questions-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const raw = await file.text();

    try {
      const parsedRows = parseCsv(raw);

      if (!parsedRows.length) {
        throw new Error("The CSV file is empty.");
      }

      const nextQuestions = parsedRows.map((row, index) => {
        const options = [
          { optionText: row.option1Text ?? "", isCorrect: parseBoolean(row.option1Correct) },
          { optionText: row.option2Text ?? "", isCorrect: parseBoolean(row.option2Correct) },
          { optionText: row.option3Text ?? "", isCorrect: parseBoolean(row.option3Correct) },
          { optionText: row.option4Text ?? "", isCorrect: parseBoolean(row.option4Correct) },
        ];

        return {
          id: `csv-${index}-${Date.now()}`,
          questionText: row.questionText ?? "",
          questionType: normalizeQuestionType(row.questionType),
          marks: row.marks ?? "1",
          explanation: row.explanation ?? "",
          options,
        } satisfies QuizQuestionForm;
      });

      setQuestions(nextQuestions.length ? nextQuestions : [createQuestion()]);
      toast.success("Quiz questions imported from CSV.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not parse CSV.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="md:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="mt-1 text-sm text-slate-600">
            Add questions directly here or import them from CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Download CSV sample
          </button>
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-2xl border border-[#e8ddff] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Import CSV
          </label>
          <input id={inputId} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvUpload} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((question, questionIndex) => (
          <div key={question.id} className="rounded-[24px] border border-[#efe6ff] bg-[#fcfbff] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-heading text-lg text-slate-950">Question {questionIndex + 1}</p>
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="text-sm font-semibold text-[#c62828]"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormBlock label="Question text">
                <textarea
                  className={fieldClassName}
                  rows={3}
                  value={question.questionText}
                  onChange={(event) => updateQuestion(question.id, { questionText: event.target.value })}
                />
              </FormBlock>
              <FormBlock label="Question type">
                <select
                  className={fieldClassName}
                  value={question.questionType}
                  onChange={(event) =>
                    updateQuestion(question.id, {
                      questionType: normalizeQuestionType(event.target.value),
                    })
                  }
                >
                  <option value="SINGLE_CHOICE">Single choice</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="TRUE_FALSE">True/False</option>
                </select>
              </FormBlock>
              <FormBlock label="Marks">
                <input
                  className={fieldClassName}
                  type="number"
                  min="1"
                  value={question.marks}
                  onChange={(event) => updateQuestion(question.id, { marks: event.target.value })}
                />
              </FormBlock>
              <FormBlock label="Explanation">
                <input
                  className={fieldClassName}
                  type="text"
                  value={question.explanation}
                  onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })}
                />
              </FormBlock>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Options</p>
              {question.options.map((option, optionIndex) => (
                <div key={`${question.id}-${optionIndex}`} className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    className={fieldClassName}
                    type="text"
                    placeholder={`Option ${optionIndex + 1}`}
                    value={option.optionText}
                    onChange={(event) => updateOption(question.id, optionIndex, { optionText: event.target.value })}
                  />
                  <label className="inline-flex items-center gap-2 rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={(event) => updateOption(question.id, optionIndex, { isCorrect: event.target.checked })}
                    />
                    Correct
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addQuestion}
          className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-700"
        >
          Add another question
        </button>
      </div>

      <input type="hidden" name={name} value={serializedQuestions} />
    </div>
  );
}

function FormBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const fieldClassName =
  "w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]";

function createQuestion(): QuizQuestionForm {
  return {
    id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questionText: "",
    questionType: "SINGLE_CHOICE",
    marks: "1",
    explanation: "",
    options: [
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
    ],
  };
}

function normalizeQuestionType(value?: string): QuizQuestionForm["questionType"] {
  if (value === "MULTIPLE_CHOICE" || value === "TRUE_FALSE") {
    return value;
  }

  return "SINGLE_CHOICE";
}

function parseBoolean(value?: string) {
  return String(value).toLowerCase() === "true";
}

function parseCsv(raw: string) {
  const rows = raw
    .trim()
    .split(/\r?\n/)
    .map((line) => splitCsvLine(line));

  if (rows.length < 2) {
    return [];
  }

  const [header, ...dataRows] = rows;

  return dataRows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])),
  );
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
