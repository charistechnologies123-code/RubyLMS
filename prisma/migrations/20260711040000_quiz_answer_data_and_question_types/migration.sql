-- Add support for richer quiz answer payloads.
ALTER TABLE "QuizAnswer"
  ADD COLUMN IF NOT EXISTS "answerData" JSONB;

-- Make sure all matching/structural types exist in older databases too.
DO $$
BEGIN
  ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'MATCHING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'STRUCTURAL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
