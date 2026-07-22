DO $$
BEGIN
  CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE IF EXISTS "Course"
  ADD COLUMN IF NOT EXISTS "attendanceDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "Poll" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
  "closesAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "courseId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PollOption" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "slotsTotal" INTEGER NOT NULL,
  "slotsTaken" INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pollId" TEXT NOT NULL,
  CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PollVote" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pollId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendanceSession" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sessionDate" TIMESTAMP(6) NOT NULL,
  "startsAt" TIMESTAMP(6),
  "endsAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "courseId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" TEXT NOT NULL,
  "clockInAt" TIMESTAMP(6),
  "clockOutAt" TIMESTAMP(6),
  "notes" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "recordedById" TEXT NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Poll_courseId_status_idx"
  ON "Poll"("courseId", "status");

CREATE INDEX IF NOT EXISTS "Poll_createdById_createdAt_idx"
  ON "Poll"("createdById", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PollOption_pollId_order_key"
  ON "PollOption"("pollId", "order");

CREATE INDEX IF NOT EXISTS "PollOption_pollId_idx"
  ON "PollOption"("pollId");

CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_pollId_studentId_key"
  ON "PollVote"("pollId", "studentId");

CREATE INDEX IF NOT EXISTS "PollVote_pollId_idx"
  ON "PollVote"("pollId");

CREATE INDEX IF NOT EXISTS "PollVote_studentId_idx"
  ON "PollVote"("studentId");

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceSession_courseId_sessionDate_key"
  ON "AttendanceSession"("courseId", "sessionDate");

CREATE INDEX IF NOT EXISTS "AttendanceSession_courseId_sessionDate_idx"
  ON "AttendanceSession"("courseId", "sessionDate");

CREATE INDEX IF NOT EXISTS "AttendanceSession_createdById_createdAt_idx"
  ON "AttendanceSession"("createdById", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_sessionId_studentId_key"
  ON "AttendanceRecord"("sessionId", "studentId");

CREATE INDEX IF NOT EXISTS "AttendanceRecord_studentId_idx"
  ON "AttendanceRecord"("studentId");

CREATE INDEX IF NOT EXISTS "AttendanceRecord_recordedById_createdAt_idx"
  ON "AttendanceRecord"("recordedById", "createdAt");

ALTER TABLE IF EXISTS "Poll"
  DROP CONSTRAINT IF EXISTS "Poll_courseId_fkey";
ALTER TABLE IF EXISTS "Poll"
  DROP CONSTRAINT IF EXISTS "Poll_createdById_fkey";
ALTER TABLE IF EXISTS "PollOption"
  DROP CONSTRAINT IF EXISTS "PollOption_pollId_fkey";
ALTER TABLE IF EXISTS "PollVote"
  DROP CONSTRAINT IF EXISTS "PollVote_pollId_fkey";
ALTER TABLE IF EXISTS "PollVote"
  DROP CONSTRAINT IF EXISTS "PollVote_optionId_fkey";
ALTER TABLE IF EXISTS "PollVote"
  DROP CONSTRAINT IF EXISTS "PollVote_studentId_fkey";
ALTER TABLE IF EXISTS "AttendanceSession"
  DROP CONSTRAINT IF EXISTS "AttendanceSession_courseId_fkey";
ALTER TABLE IF EXISTS "AttendanceSession"
  DROP CONSTRAINT IF EXISTS "AttendanceSession_createdById_fkey";
ALTER TABLE IF EXISTS "AttendanceRecord"
  DROP CONSTRAINT IF EXISTS "AttendanceRecord_sessionId_fkey";
ALTER TABLE IF EXISTS "AttendanceRecord"
  DROP CONSTRAINT IF EXISTS "AttendanceRecord_studentId_fkey";
ALTER TABLE IF EXISTS "AttendanceRecord"
  DROP CONSTRAINT IF EXISTS "AttendanceRecord_recordedById_fkey";

ALTER TABLE IF EXISTS "Poll"
  ADD CONSTRAINT "Poll_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "Poll"
  ADD CONSTRAINT "Poll_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "PollOption"
  ADD CONSTRAINT "PollOption_pollId_fkey"
  FOREIGN KEY ("pollId") REFERENCES "Poll"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "PollVote"
  ADD CONSTRAINT "PollVote_pollId_fkey"
  FOREIGN KEY ("pollId") REFERENCES "Poll"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "PollVote"
  ADD CONSTRAINT "PollVote_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "PollOption"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "PollVote"
  ADD CONSTRAINT "PollVote_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE IF EXISTS "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
