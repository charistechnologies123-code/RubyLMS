-- CreateTable
CREATE TABLE "LessonPage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "externalUrl" TEXT,
    "imageUrl" TEXT,
    "embedUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "LessonPage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "lessonId" TEXT;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "lessonId" TEXT;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "lessonPageId" TEXT;

-- CreateIndex
CREATE INDEX "LessonPage_lessonId_idx" ON "LessonPage"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPage_lessonId_slug_key" ON "LessonPage"("lessonId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPage_lessonId_order_key" ON "LessonPage"("lessonId", "order");

-- CreateIndex
CREATE INDEX "Assignment_lessonId_idx" ON "Assignment"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Resource_lessonPageId_idx" ON "Resource"("lessonPageId");

-- AddForeignKey
ALTER TABLE "LessonPage" ADD CONSTRAINT "LessonPage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_lessonPageId_fkey" FOREIGN KEY ("lessonPageId") REFERENCES "LessonPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
