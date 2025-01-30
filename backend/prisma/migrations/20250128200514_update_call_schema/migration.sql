/*
  Warnings:

  - You are about to drop the column `detectedKeywords` on the `CallLog` table. All the data in the column will be lost.
  - You are about to drop the column `notificationSent` on the `CallLog` table. All the data in the column will be lost.
  - You are about to drop the column `recordingUrl` on the `CallLog` table. All the data in the column will be lost.
  - You are about to drop the column `transcription` on the `CallLog` table. All the data in the column will be lost.
  - You are about to drop the `Keyword` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[roomId]` on the table `CallLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roomId` to the `CallLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'CONNECTING', 'CONNECTED', 'ENDED', 'FAILED', 'REJECTED', 'TIMEOUT');

-- DropForeignKey
ALTER TABLE "Keyword" DROP CONSTRAINT "Keyword_patientId_fkey";

-- AlterTable
ALTER TABLE "CallLog" DROP COLUMN "detectedKeywords",
DROP COLUMN "notificationSent",
DROP COLUMN "recordingUrl",
DROP COLUMN "transcription",
ADD COLUMN     "connectionType" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomId" TEXT NOT NULL,
ADD COLUMN     "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
ALTER COLUMN "startTime" DROP DEFAULT,
ALTER COLUMN "isWebRTC" SET DEFAULT true;

-- DropTable
DROP TABLE "Keyword";

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_roomId_key" ON "CallLog"("roomId");

-- CreateIndex
CREATE INDEX "CallLog_patientId_idx" ON "CallLog"("patientId");

-- CreateIndex
CREATE INDEX "CallLog_status_idx" ON "CallLog"("status");

-- CreateIndex
CREATE INDEX "Patient_caretakerId_idx" ON "Patient"("caretakerId");
