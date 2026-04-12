ALTER TABLE "LessonPage"
ADD COLUMN "estimatedDurationMinutes" INTEGER;

CREATE TABLE "LessonPageProgress" (
    "id" TEXT NOT NULL,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonPageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "LessonPageProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonPageProgress_lessonPageId_studentId_key" ON "LessonPageProgress"("lessonPageId", "studentId");
CREATE INDEX "LessonPageProgress_studentId_idx" ON "LessonPageProgress"("studentId");

ALTER TABLE "LessonPageProgress"
ADD CONSTRAINT "LessonPageProgress_lessonPageId_fkey"
FOREIGN KEY ("lessonPageId") REFERENCES "LessonPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonPageProgress"
ADD CONSTRAINT "LessonPageProgress_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
