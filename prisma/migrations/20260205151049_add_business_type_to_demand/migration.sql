-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('REGULAR', 'ADHOC');

-- AlterTable
ALTER TABLE "DemandForecast" ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'REGULAR';
