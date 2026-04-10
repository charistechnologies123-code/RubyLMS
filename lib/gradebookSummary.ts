export function calculateGradebookTotals(
  columns: Array<{ id: string; maxScore: number | null; includeInTotals: boolean }>,
  cells: Array<{ columnId: string; score: number | null | undefined }>,
) {
  let totalScore = 0;
  let totalPossible = 0;

  for (const column of columns) {
    if (!column.includeInTotals) {
      continue;
    }

    const cell = cells.find((item) => item.columnId === column.id);

    if (typeof cell?.score === "number") {
      totalScore += cell.score;
    }

    if (typeof column.maxScore === "number" && column.maxScore > 0) {
      totalPossible += column.maxScore;
    }
  }

  return {
    totalScore,
    totalPossible,
    averagePercent: totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0,
  };
}
