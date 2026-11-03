CREATE TYPE "GameLevel" AS ENUM ('BEGINNER', 'CASUAL', 'COMPETITIVE', 'ALL_LEVELS');
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CREATED';
ALTER TABLE "Event" ADD COLUMN "priceMinor" INTEGER,
  ADD COLUMN "level" "GameLevel",
  ADD COLUMN "newcomerInfo" TEXT;
ALTER TABLE "Event" ADD CONSTRAINT "Event_priceMinor_nonnegative" CHECK ("priceMinor" IS NULL OR "priceMinor" >= 0);
CREATE TABLE "CityGameSubscription" (
  "userId" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CityGameSubscription_pkey" PRIMARY KEY ("userId", "cityId"),
  CONSTRAINT "CityGameSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CityGameSubscription_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CityGameSubscription_cityId_idx" ON "CityGameSubscription"("cityId");
