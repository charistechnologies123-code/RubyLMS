UPDATE "Resource" AS resource
SET "lessonId" = page."lessonId"
FROM "LessonPage" AS page
WHERE resource."lessonPageId" = page."id";

ALTER TABLE IF EXISTS "Resource"
  DROP CONSTRAINT IF EXISTS "Resource_lessonPageId_fkey";

DROP INDEX IF EXISTS "Resource_lessonPageId_idx";

ALTER TABLE IF EXISTS "Resource"
  DROP COLUMN IF EXISTS "lessonPageId";
