CREATE TYPE "GradebookColumnType" AS ENUM ('QUIZ', 'ASSIGNMENT', 'ATTENDANCE', 'CUSTOM');

CREATE TABLE "GradebookColumn" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "GradebookColumnType" NOT NULL,
    "sourceId" TEXT,
    "order" INTEGER NOT NULL,
    "maxScore" DOUBLE PRECISION,
    "includeInTotals" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "GradebookColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradebookCell" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "columnId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "selectedQuizAttemptId" TEXT,
    "selectedAssignmentSubmissionId" TEXT,

    CONSTRAINT "GradebookCell_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradebookColumn_courseId_key_key" ON "GradebookColumn"("courseId", "key");
CREATE UNIQUE INDEX "GradebookColumn_courseId_order_key" ON "GradebookColumn"("courseId", "order");
CREATE INDEX "GradebookColumn_courseId_idx" ON "GradebookColumn"("courseId");
CREATE INDEX "GradebookColumn_type_sourceId_idx" ON "GradebookColumn"("type", "sourceId");

CREATE UNIQUE INDEX "GradebookCell_columnId_studentId_key" ON "GradebookCell"("columnId", "studentId");
CREATE INDEX "GradebookCell_courseId_idx" ON "GradebookCell"("courseId");
CREATE INDEX "GradebookCell_studentId_idx" ON "GradebookCell"("studentId");
CREATE INDEX "GradebookCell_selectedQuizAttemptId_idx" ON "GradebookCell"("selectedQuizAttemptId");
CREATE INDEX "GradebookCell_selectedAssignmentSubmissionId_idx" ON "GradebookCell"("selectedAssignmentSubmissionId");

ALTER TABLE "GradebookColumn" ADD CONSTRAINT "GradebookColumn_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookColumn" ADD CONSTRAINT "GradebookColumn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GradebookCell" ADD CONSTRAINT "GradebookCell_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "GradebookColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookCell" ADD CONSTRAINT "GradebookCell_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookCell" ADD CONSTRAINT "GradebookCell_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookCell" ADD CONSTRAINT "GradebookCell_selectedQuizAttemptId_fkey" FOREIGN KEY ("selectedQuizAttemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GradebookCell" ADD CONSTRAINT "GradebookCell_selectedAssignmentSubmissionId_fkey" FOREIGN KEY ("selectedAssignmentSubmissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
