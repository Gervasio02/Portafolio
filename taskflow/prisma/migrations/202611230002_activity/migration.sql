CREATE TABLE "Activity" (
 "id" UUID NOT NULL,
 "boardId" UUID NOT NULL,
 "cardId" UUID NOT NULL,
 "actorId" UUID,
 "action" VARCHAR(32) NOT NULL,
 "body" VARCHAR(2000) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Activity_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Activity_boardId_cardId_createdAt_idx" ON "Activity"("boardId", "cardId", "createdAt");
