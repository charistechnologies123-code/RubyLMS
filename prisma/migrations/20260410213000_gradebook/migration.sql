CREATE TYPE "GradebookSourceType" AS ENUM ('QUIZ', 'ASSIGNMENT', 'MANUAL');

CREATE TABLE "GradebookEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "sourceType" "GradebookSourceType" NOT NULL,
    "sourceId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "GradebookEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradebookPublication" (
    "id" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "GradebookPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradebookEntry_courseId_studentId_entryKey_key" ON "GradebookEntry"("courseId", "studentId", "entryKey");
CREATE INDEX "GradebookEntry_courseId_idx" ON "GradebookEntry"("courseId");
CREATE INDEX "GradebookEntry_studentId_idx" ON "GradebookEntry"("studentId");
CREATE UNIQUE INDEX "GradebookPublication_courseId_key" ON "GradebookPublication"("courseId");

ALTER TABLE "GradebookEntry" ADD CONSTRAINT "GradebookEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookEntry" ADD CONSTRAINT "GradebookEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookPublication" ADD CONSTRAINT "GradebookPublication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookPublication" ADD CONSTRAINT "GradebookPublication_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
