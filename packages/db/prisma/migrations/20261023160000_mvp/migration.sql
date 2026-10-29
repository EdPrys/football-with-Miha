-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MVP_AWARDED';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "mvpResolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MvpVote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvpVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMvp" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "votes" INTEGER NOT NULL,

    CONSTRAINT "EventMvp_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateIndex
CREATE INDEX "MvpVote_nomineeId_idx" ON "MvpVote"("nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "MvpVote_eventId_voterId_key" ON "MvpVote"("eventId", "voterId");

-- CreateIndex
CREATE INDEX "EventMvp_userId_idx" ON "EventMvp"("userId");

-- AddForeignKey
ALTER TABLE "MvpVote" ADD CONSTRAINT "MvpVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpVote" ADD CONSTRAINT "MvpVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpVote" ADD CONSTRAINT "MvpVote_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMvp" ADD CONSTRAINT "EventMvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMvp" ADD CONSTRAINT "EventMvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

