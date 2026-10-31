CREATE TYPE "FieldEnvironment" AS ENUM ('OPEN_AIR', 'COVERED', 'INDOOR');
CREATE TYPE "FieldSurface" AS ENUM ('NATURAL_GRASS', 'ARTIFICIAL_TURF', 'PARQUET', 'RUBBER', 'HARD_COURT', 'OTHER');

ALTER TABLE "Venue"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "totalFields" INTEGER,
  ADD COLUMN "hasChangingRooms" BOOLEAN,
  ADD COLUMN "hasShowers" BOOLEAN,
  ADD COLUMN "hasParking" BOOLEAN,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

ALTER TABLE "Field"
  ALTER COLUMN "capacity" DROP NOT NULL,
  ADD COLUMN "environment" "FieldEnvironment",
  ADD COLUMN "surface" "FieldSurface",
  ADD COLUMN "hasLighting" BOOLEAN,
  ADD COLUMN "lengthMeters" DOUBLE PRECISION,
  ADD COLUMN "widthMeters" DOUBLE PRECISION;
