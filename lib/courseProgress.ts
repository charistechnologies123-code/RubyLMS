export function getRequiredSeconds(estimatedDurationMinutes?: number | null) {
  if (!estimatedDurationMinutes || estimatedDurationMinutes <= 0) {
    return 0;
  }

  return Math.round(estimatedDurationMinutes * 60);
}

export function calculateCourseProgress(completedPages: number, totalPages: number) {
  if (!totalPages) {
    return {
      completedPages,
      totalPages,
      percentage: 0,
    };
  }

  return {
    completedPages,
    totalPages,
    percentage: Math.round((completedPages / totalPages) * 100),
  };
}

export function formatEstimatedDuration(estimatedDurationMinutes?: number | null) {
  if (!estimatedDurationMinutes || estimatedDurationMinutes <= 0) {
    return "No estimated duration";
  }

  return `${estimatedDurationMinutes} min`;
}

export function formatElapsedTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
