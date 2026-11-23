ALTER TABLE "Column" ADD COLUMN "wipLimit" INTEGER;
ALTER TABLE "Column" ADD CONSTRAINT "Column_wipLimit_positive" CHECK ("wipLimit" IS NULL OR "wipLimit" > 0);
ALTER TABLE "Card" ADD COLUMN "assigneeId" UUID;
ALTER TABLE "Card" ADD CONSTRAINT "Card_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Card_assigneeId_idx" ON "Card"("assigneeId");
