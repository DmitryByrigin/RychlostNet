/*
  Warnings:

  - The primary key for the `SpeedTestHistory` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "SpeedTestHistory" DROP CONSTRAINT "SpeedTestHistory_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "SpeedTestHistory_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SpeedTestHistory_id_seq";
