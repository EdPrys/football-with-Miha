ALTER TYPE "NotificationType" ADD VALUE 'SLOT_AVAILABLE';
ALTER TABLE "Event" ADD COLUMN "organizerPhone" TEXT, ADD COLUMN "organizerTelegram" TEXT;
ALTER TABLE "EventParticipant" ADD COLUMN "remindBeforeGame" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderSentAt" TIMESTAMP(3);
CREATE INDEX "EventParticipant_remindBeforeGame_reminderSentAt_idx" ON "EventParticipant"("remindBeforeGame", "reminderSentAt");
CREATE TABLE "EventWaitlist" (
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventWaitlist_pkey" PRIMARY KEY ("eventId", "userId"),
  CONSTRAINT "EventWaitlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EventWaitlist_userId_idx" ON "EventWaitlist"("userId");
