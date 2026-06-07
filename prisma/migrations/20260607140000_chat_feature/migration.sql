DO $$
BEGIN
  CREATE TYPE "ChatRoomType" AS ENUM ('DIRECT', 'GROUP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id" TEXT NOT NULL,
  "type" "ChatRoomType" NOT NULL DEFAULT 'DIRECT',
  "title" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(6),
  CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatMember" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(6),
  CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE IF EXISTS "ChatRoom"
  DROP CONSTRAINT IF EXISTS "ChatRoom_createdById_fkey";

ALTER TABLE IF EXISTS "ChatMember"
  DROP CONSTRAINT IF EXISTS "ChatMember_roomId_fkey";

ALTER TABLE IF EXISTS "ChatMember"
  DROP CONSTRAINT IF EXISTS "ChatMember_userId_fkey";

ALTER TABLE IF EXISTS "ChatMessage"
  DROP CONSTRAINT IF EXISTS "ChatMessage_roomId_fkey";

ALTER TABLE IF EXISTS "ChatMessage"
  DROP CONSTRAINT IF EXISTS "ChatMessage_senderId_fkey";

ALTER TABLE IF EXISTS "ChatRoom"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT,
  ALTER COLUMN "createdById" TYPE TEXT USING "createdById"::TEXT;

ALTER TABLE IF EXISTS "ChatMember"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT,
  ALTER COLUMN "roomId" TYPE TEXT USING "roomId"::TEXT,
  ALTER COLUMN "userId" TYPE TEXT USING "userId"::TEXT;

ALTER TABLE IF EXISTS "ChatMessage"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT,
  ALTER COLUMN "roomId" TYPE TEXT USING "roomId"::TEXT,
  ALTER COLUMN "senderId" TYPE TEXT USING "senderId"::TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMember_roomId_userId_key"
  ON "ChatMember"("roomId", "userId");

CREATE INDEX IF NOT EXISTS "ChatMember_userId_roomId_idx"
  ON "ChatMember"("userId", "roomId");

CREATE INDEX IF NOT EXISTS "ChatRoom_type_lastMessageAt_idx"
  ON "ChatRoom"("type", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "ChatRoom_createdById_createdAt_idx"
  ON "ChatRoom"("createdById", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
  ON "ChatMessage"("roomId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_createdAt_idx"
  ON "ChatMessage"("senderId", "createdAt");

ALTER TABLE IF EXISTS "ChatRoom"
  ADD CONSTRAINT "ChatRoom_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE IF EXISTS "ChatMember"
  ADD CONSTRAINT "ChatMember_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE IF EXISTS "ChatMember"
  ADD CONSTRAINT "ChatMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE IF EXISTS "ChatMessage"
  ADD CONSTRAINT "ChatMessage_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE IF EXISTS "ChatMessage"
  ADD CONSTRAINT "ChatMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
