DO $$
BEGIN
  CREATE TYPE "LiveClassStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LiveClass" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "roomName" TEXT NOT NULL,
  "startsAt" TIMESTAMP(6) NOT NULL,
  "endsAt" TIMESTAMP(6),
  "status" "LiveClassStatus" NOT NULL DEFAULT 'SCHEDULED',
  "allowChat" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "courseId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveClass_roomName_key"
  ON "LiveClass"("roomName");

CREATE INDEX IF NOT EXISTS "LiveClass_courseId_startsAt_idx"
  ON "LiveClass"("courseId", "startsAt");

CREATE INDEX IF NOT EXISTS "LiveClass_createdById_startsAt_idx"
  ON "LiveClass"("createdById", "startsAt");

ALTER TABLE IF EXISTS "LiveClass"
  DROP CONSTRAINT IF EXISTS "LiveClass_courseId_fkey";

ALTER TABLE IF EXISTS "LiveClass"
  DROP CONSTRAINT IF EXISTS "LiveClass_createdById_fkey";

ALTER TABLE IF EXISTS "LiveClass"
  ADD CONSTRAINT "LiveClass_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE IF EXISTS "LiveClass"
  ADD CONSTRAINT "LiveClass_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
