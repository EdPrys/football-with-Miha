-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'MANAGER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PLAYER';
