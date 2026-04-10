CREATE TABLE "CourseManager" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CourseManager_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseManager_courseId_userId_key" ON "CourseManager"("courseId", "userId");
CREATE INDEX "CourseManager_courseId_idx" ON "CourseManager"("courseId");
CREATE INDEX "CourseManager_userId_idx" ON "CourseManager"("userId");

ALTER TABLE "CourseManager"
ADD CONSTRAINT "CourseManager_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseManager"
ADD CONSTRAINT "CourseManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
