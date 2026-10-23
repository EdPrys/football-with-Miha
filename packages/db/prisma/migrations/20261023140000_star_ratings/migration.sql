-- Event: when the game was finished (star ratings close 24h after this).
ALTER TABLE "Event" ADD COLUMN "finishedAt" TIMESTAMP(3);
-- Already finished games: best available approximation is the last update.
UPDATE "Event" SET "finishedAt" = "updatedAt" WHERE "status" = 'FINISHED';

-- Rating: a single 1–5 star score replaces the six per-skill scores.
ALTER TABLE "Rating" ADD COLUMN "stars" INTEGER;
UPDATE "Rating"
SET "stars" = ROUND(("pace" + "dribbling" + "passing" + "shooting" + "defending" + "physical") / 6.0);
ALTER TABLE "Rating" ALTER COLUMN "stars" SET NOT NULL;

-- Keep the legacy per-skill scores for history; new rows leave them null.
ALTER TABLE "Rating" ALTER COLUMN "pace" DROP NOT NULL,
ALTER COLUMN "dribbling" DROP NOT NULL,
ALTER COLUMN "passing" DROP NOT NULL,
ALTER COLUMN "shooting" DROP NOT NULL,
ALTER COLUMN "defending" DROP NOT NULL,
ALTER COLUMN "physical" DROP NOT NULL;
