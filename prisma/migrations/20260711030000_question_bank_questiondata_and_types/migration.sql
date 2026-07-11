-- Add the newer quiz question types used by the app.
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

-- Align the database with the Prisma schema for quiz question metadata.
ALTER TABLE "QuestionBankItem"
  ADD COLUMN IF NOT EXISTS "questionData" JSONB;
