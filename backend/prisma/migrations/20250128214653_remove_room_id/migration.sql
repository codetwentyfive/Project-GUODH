/*
  Warnings:

  - You are about to drop the column `roomId` on the `CallLog` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CallLog_roomId_key";

-- AlterTable
ALTER TABLE "CallLog" DROP COLUMN "roomId";
