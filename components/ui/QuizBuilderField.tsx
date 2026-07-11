"use client";

import type { ChangeEvent } from "react";
import { useId, useMemo, useState } from "react";
import toast from "react-hot-toast";

type QuizOptionForm = {
  optionText: string;
  isCorrect: boolean;
};

type QuizMatchingPairForm = {
  promptText: string;
  answerText: string;
};

type QuizQuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "MATCHING"
  | "STRUCTURAL"
  | "TRUE_FALSE";

type QuizQuestionForm = {
  id: string;
  questionText: string;
  questionType: QuizQuestionType;
  marks: string;
  explanation: string;
  answerText: string;
  options: QuizOptionForm[];
  matchingPairs: QuizMatchingPairForm[];
  acceptedAnswers: string[];
};

type QuizBuilderFieldProps = {
  name?: string;
  label?: string;
  initialQuestions?: any[];
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
    initialQuestions?.length ? initialQuestions.map(normalizeQuestionSeed) : [createQuestion()],
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
          matchingPairs: question.matchingPairs
            .filter((pair) => pair.promptText.trim() || pair.answerText.trim())
            .map((pair) => ({
              promptText: pair.promptText,
              answerText: pair.answerText,
            })),
          acceptedAnswers: question.acceptedAnswers.filter((answer) => answer.trim()),
        })),
      ),
    [questions],
  );

  function updateQuestion(questionId: string, updates: Partial<QuizQuestionForm>) {
    setQuestions((current) => current.map((question) => (question.id === questionId ? { ...question, ...updates } : question)));
  }

  function updateQuestionType(questionId: string, questionType: QuizQuestionType) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return adaptQuestionType(question, questionType);
      }),
    );
  }

  function updateOption(questionId: string, optionIndex: number, updates: Partial<QuizOptionForm>) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextOptions = question.options.map((option, index) => (index === optionIndex ? { ...option, ...updates } : option));

        return { ...question, options: nextOptions };
      }),
    );
  }

  function updateMatchingPair(questionId: string, pairIndex: number, updates: Partial<QuizMatchingPairForm>) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextPairs = question.matchingPairs.map((pair, index) => (index === pairIndex ? { ...pair, ...updates } : pair));

        return { ...question, matchingPairs: nextPairs };
      }),
    );
  }

  function updateAcceptedAnswer(questionId: string, answerIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextAnswers = question.acceptedAnswers.map((answer, index) => (index === answerIndex ? value : answer));
        return { ...question, acceptedAnswers: nextAnswers };
      }),
    );
  }

  function addMatchingPair(questionId: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, matchingPairs: [...question.matchingPairs, createMatchingPair()] } : question,
      ),
    );
  }

  function removeMatchingPair(questionId: string, pairIndex: number) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId || question.matchingPairs.length === 1) {
          return question;
        }

        return { ...question, matchingPairs: question.matchingPairs.filter((_, index) => index !== pairIndex) };
      }),
    );
  }

  function addAcceptedAnswer(questionId: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, acceptedAnswers: [...question.acceptedAnswers, ""] } : question,
      ),
    );
  }

  function removeAcceptedAnswer(questionId: string, answerIndex: number) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId || question.acceptedAnswers.length === 1) {
          return question;
        }

        return { ...question, acceptedAnswers: question.acceptedAnswers.filter((_, index) => index !== answerIndex) };
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
          answerText: row.answerText ?? "",
          options,
          matchingPairs: [createMatchingPair(), createMatchingPair()],
          acceptedAnswers: [""],
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
          <p className="mt-1 text-sm text-slate-600">Add questions directly here or import them from CSV.</p>
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
        {questions.map((question, questionIndex) => {
          const isMatching = question.questionType === "MATCHING";
          const isStructural = question.questionType === "STRUCTURAL";
          const isTrueFalse = question.questionType === "TRUE_FALSE";
          const isChoiceQuestion = !isMatching && !isStructural;

          return (
            <div key={question.id} className="rounded-[24px] border border-[#efe6ff] bg-[#fcfbff] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-heading text-lg text-slate-950">Question {questionIndex + 1}</p>
                {questions.length > 1 ? (
                  <button type="button" onClick={() => removeQuestion(question.id)} className="text-sm font-semibold text-[#c62828]">
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
                    onChange={(event) => updateQuestionType(question.id, normalizeQuestionType(event.target.value))}
                  >
                    <option value="SINGLE_CHOICE">Single choice</option>
                    <option value="MULTIPLE_CHOICE">Checkbox / multiple answer</option>
                    <option value="MATCHING">Matching</option>
                    <option value="STRUCTURAL">Structural</option>
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

              {isChoiceQuestion ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">{isTrueFalse ? "Answer choices" : "Options"}</p>
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.id}-${optionIndex}`} className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        className={fieldClassName}
                        type="text"
                        placeholder={isTrueFalse ? (optionIndex === 0 ? "True" : "False") : `Option ${optionIndex + 1}`}
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
              ) : null}

              {isMatching ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Matching pairs</p>
                    <button
                      type="button"
                      onClick={() => addMatchingPair(question.id)}
                      className="text-sm font-semibold text-[#6b00ff]"
                    >
                      Add pair
                    </button>
                  </div>
                  {question.matchingPairs.map((pair, pairIndex) => (
                    <div key={`${question.id}-pair-${pairIndex}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <input
                        className={fieldClassName}
                        type="text"
                        placeholder={`Prompt ${pairIndex + 1}`}
                        value={pair.promptText}
                        onChange={(event) => updateMatchingPair(question.id, pairIndex, { promptText: event.target.value })}
                      />
                      <input
                        className={fieldClassName}
                        type="text"
                        placeholder={`Match ${pairIndex + 1}`}
                        value={pair.answerText}
                        onChange={(event) => updateMatchingPair(question.id, pairIndex, { answerText: event.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeMatchingPair(question.id, pairIndex)}
                        className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#c62828] disabled:opacity-50"
                        disabled={question.matchingPairs.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {isStructural ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Accepted answers</p>
                    <button
                      type="button"
                      onClick={() => addAcceptedAnswer(question.id)}
                      className="text-sm font-semibold text-[#6b00ff]"
                    >
                      Add answer
                    </button>
                  </div>
                  {question.acceptedAnswers.map((answer, answerIndex) => (
                    <div key={`${question.id}-answer-${answerIndex}`} className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        className={fieldClassName}
                        type="text"
                        value={answer}
                        onChange={(event) => updateAcceptedAnswer(question.id, answerIndex, event.target.value)}
                        placeholder={`Accepted answer ${answerIndex + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeAcceptedAnswer(question.id, answerIndex)}
                        className="rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#c62828] disabled:opacity-50"
                        disabled={question.acceptedAnswers.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
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

function normalizeQuestionSeed(question: any): QuizQuestionForm {
  const matchingPairs = Array.isArray(question.matchingPairs) && question.matchingPairs.length
    ? question.matchingPairs
    : [createMatchingPair(), createMatchingPair()];
  const acceptedAnswers = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length
    ? question.acceptedAnswers
    : [""];

  return {
    ...question,
    answerText: question.answerText ?? "",
    options: Array.isArray(question.options) && question.options.length ? question.options : createChoiceOptions(4),
    matchingPairs,
    acceptedAnswers,
  };
}

function createQuestion(): QuizQuestionForm {
  return {
    id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questionText: "",
    questionType: "SINGLE_CHOICE",
    marks: "1",
    explanation: "",
    answerText: "",
    options: createChoiceOptions(4),
    matchingPairs: [createMatchingPair(), createMatchingPair()],
    acceptedAnswers: [""],
  };
}

function createChoiceOptions(count: number) {
  return Array.from({ length: count }, () => ({ optionText: "", isCorrect: false }));
}

function createMatchingPair(): QuizMatchingPairForm {
  return {
    promptText: "",
    answerText: "",
  };
}

function adaptQuestionType(question: QuizQuestionForm, questionType: QuizQuestionType): QuizQuestionForm {
  if (questionType === "MATCHING") {
    return {
      ...question,
      questionType,
      options: [],
      matchingPairs: question.matchingPairs.length ? question.matchingPairs : [createMatchingPair(), createMatchingPair()],
      acceptedAnswers: [],
    };
  }

  if (questionType === "STRUCTURAL") {
    return {
      ...question,
      questionType,
      options: [],
      matchingPairs: [],
      acceptedAnswers: question.acceptedAnswers.length ? question.acceptedAnswers : [""],
    };
  }

  if (questionType === "TRUE_FALSE") {
    return {
      ...question,
      questionType,
      answerText: "",
      options: ensureTrueFalseOptions(question.options),
      matchingPairs: [],
      acceptedAnswers: [],
    };
  }

  return {
    ...question,
    questionType,
    answerText: "",
    options: question.options.length ? question.options : createChoiceOptions(4),
    matchingPairs: [],
    acceptedAnswers: [],
  };
}

function ensureTrueFalseOptions(options: QuizOptionForm[]) {
  const nextOptions = options.slice(0, 2);

  while (nextOptions.length < 2) {
    nextOptions.push({ optionText: "", isCorrect: false });
  }

  if (!nextOptions[0].optionText.trim()) {
    nextOptions[0] = { ...nextOptions[0], optionText: "True" };
  }

  if (!nextOptions[1].optionText.trim()) {
    nextOptions[1] = { ...nextOptions[1], optionText: "False" };
  }

  return nextOptions;
}

function normalizeQuestionType(value?: string): QuizQuestionType {
  if (
    value === "MULTIPLE_CHOICE" ||
    value === "MATCHING" ||
    value === "STRUCTURAL" ||
    value === "TRUE_FALSE"
  ) {
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

  return dataRows.map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
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







