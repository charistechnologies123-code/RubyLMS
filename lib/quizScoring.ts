type QuizQuestionScoreInput = {
  id: string;
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "MATCHING" | "STRUCTURAL" | "TRUE_FALSE";
  marks: number;
  questionData?: any;
  options?: Array<{
    id: string;
    optionText: string;
    isCorrect: boolean;
  }>;
};

export type QuizSubmittedAnswer = {
  quizQuestionId: string;
  selectedOptionIds?: string[];
  matchingSelections?: string[];
  textAnswer?: string;
};

export type QuizQuestionScoreResult = {
  quizQuestionId: string;
  questionText: string;
  questionType: QuizQuestionScoreInput["questionType"];
  maxScore: number;
  earnedScore: number;
  isCorrect: boolean;
  selectedOptionIds: string[];
  selectedOptionLabels: string[];
  matchingSelections: string[];
  textAnswer: string;
  correctAnswers: string[];
};

export function normalizeQuizAnswer(value: string) {
  return value.trim().toLowerCase();
}

export function formatQuizScore(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/.$/, "");
}

function scoreStructural(question: QuizQuestionScoreInput, submittedAnswer: QuizSubmittedAnswer | undefined): QuizQuestionScoreResult {
  const acceptedAnswers = ((question.questionData?.acceptedAnswers ?? [question.questionData?.answerText ?? ""]) as string[])
    .map(normalizeQuizAnswer)
    .filter(Boolean);
  const textAnswer = submittedAnswer?.textAnswer ?? "";
  const normalizedAnswer = normalizeQuizAnswer(textAnswer);
  const isCorrect = acceptedAnswers.length > 0 && acceptedAnswers.includes(normalizedAnswer);

  return {
    quizQuestionId: question.id,
    questionText: question.questionText,
    questionType: question.questionType,
    maxScore: question.marks,
    earnedScore: isCorrect ? question.marks : 0,
    isCorrect,
    selectedOptionIds: [],
    selectedOptionLabels: [],
    matchingSelections: [],
    textAnswer,
    correctAnswers: acceptedAnswers,
  };
}

function scoreMatching(question: QuizQuestionScoreInput, submittedAnswer: QuizSubmittedAnswer | undefined): QuizQuestionScoreResult {
  const matchingPairs = (question.questionData?.matchingPairs ?? []) as Array<{ promptText: string; answerText: string }>;
  const matchingSelections = submittedAnswer?.matchingSelections ?? [];
  const perMatchScore = matchingPairs.length > 0 ? question.marks / matchingPairs.length : 0;
  const correctCount = matchingPairs.reduce((count, pair, index) => {
    const expected = normalizeQuizAnswer(pair.answerText);
    const selected = normalizeQuizAnswer(matchingSelections[index] ?? "");
    return count + (expected && expected === selected ? 1 : 0);
  }, 0);
  const earnedScore = matchingPairs.length > 0 ? Math.min(question.marks, correctCount * perMatchScore) : 0;

  return {
    quizQuestionId: question.id,
    questionText: question.questionText,
    questionType: question.questionType,
    maxScore: question.marks,
    earnedScore: roundScore(earnedScore),
    isCorrect: matchingPairs.length > 0 && correctCount === matchingPairs.length,
    selectedOptionIds: [],
    selectedOptionLabels: [],
    matchingSelections,
    textAnswer: "",
    correctAnswers: matchingPairs.map((pair) => pair.answerText),
  };
}

function scoreChoice(question: QuizQuestionScoreInput, submittedAnswer: QuizSubmittedAnswer | undefined): QuizQuestionScoreResult {
  const correctOptions = (question.options ?? []).filter((option) => option.isCorrect);
  const selectedOptionIds = Array.from(new Set(submittedAnswer?.selectedOptionIds ?? [])).filter(Boolean);
  const selectedOptionLabels = selectedOptionIds
    .map((selectedId) => question.options?.find((option) => option.id === selectedId)?.optionText ?? "")
    .filter(Boolean);
  const correctOptionIds = correctOptions.map((option) => option.id);
  const correctSelectedCount = selectedOptionIds.filter((selectedId) => correctOptionIds.includes(selectedId)).length;
  const perCorrectOptionScore = correctOptions.length > 0 ? question.marks / correctOptions.length : 0;
  const earnedScore = roundScore(Math.min(question.marks, correctSelectedCount * perCorrectOptionScore));
  const isSingleChoice = question.questionType === "SINGLE_CHOICE" || question.questionType === "TRUE_FALSE";
  const isCorrect = isSingleChoice
    ? correctOptionIds.length === 1 && selectedOptionIds.length === 1 && correctOptionIds[0] === selectedOptionIds[0]
    : correctSelectedCount === correctOptionIds.length && correctOptionIds.length > 0;

  return {
    quizQuestionId: question.id,
    questionText: question.questionText,
    questionType: question.questionType,
    maxScore: question.marks,
    earnedScore: isCorrect ? question.marks : earnedScore,
    isCorrect,
    selectedOptionIds,
    selectedOptionLabels,
    matchingSelections: [],
    textAnswer: "",
    correctAnswers: correctOptions.map((option) => option.optionText),
  };
}

export function scoreQuizQuestion(question: QuizQuestionScoreInput, submittedAnswer: QuizSubmittedAnswer | undefined) {
  if (question.questionType === "STRUCTURAL") {
    return scoreStructural(question, submittedAnswer);
  }

  if (question.questionType === "MATCHING") {
    return scoreMatching(question, submittedAnswer);
  }

  return scoreChoice(question, submittedAnswer);
}

export function scoreQuizAttempt(questions: QuizQuestionScoreInput[], answers: QuizSubmittedAnswer[]) {
  const answersByQuestionId = new Map(answers.map((answer) => [answer.quizQuestionId, answer]));
  const breakdown = questions.map((question) => scoreQuizQuestion(question, answersByQuestionId.get(question.id)));
  const totalScore = roundScore(breakdown.reduce((sum, result) => sum + result.earnedScore, 0));
  const totalPossible = roundScore(breakdown.reduce((sum, question) => sum + question.maxScore, 0));

  return {
    totalScore,
    totalPossible,
    breakdown,
  };
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

